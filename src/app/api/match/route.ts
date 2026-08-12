import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import etfs from "../../../../public/data/etfs.json";
import type { ETF } from "../../../../types/etf";
import {
  filterCandidates,
  describeEtf,
  type RiskPreference,
  type SectorTilt,
} from "@/lib/etf-filter";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Shape of the quiz answers the client sends in the POST body. */
const QuizRequestSchema = z.object({
  region: z.enum(["world", "us", "europe", "emerging_markets"]),
  distributionPolicy: z.enum(["acc", "dist"]),
  esgStatus: z.enum(["none", "article_8", "article_9"]),
  riskPreference: z.enum(["low_vol", "balanced", "max_div"]),
  sectorTilt: z.enum(["none", "tech", "dividend", "healthcare"]),
});

/** Shape of a single matched ETF returned to the client. */
const MatchResultSchema = z.object({
  matches: z
    .array(
      z.object({
        isin: z.string(),
        name: z.string(),
        rationale: z.string(),
      })
    )
    .min(1)
    .max(3),
  /**
   * Everything a follow-up LLM call needs to reason about this session
   * without re-fetching anything: the user's quiz answers translated into
   * human-readable form, and the candidate ETFs pre-summarised for the
   * prompt. The client caches this so a later "explain this ETF again" or
   * "compare the two" request can be answered locally.
   */
  session: z.object({
    answers: z.object({
      region: z.string(),
      distributionPolicy: z.string(),
      esgStatus: z.string(),
      riskPreference: z.string(),
      sectorTilt: z.string(),
    }),
    candidates: z.array(
      z.object({
        isin: z.string(),
        name: z.string(),
        summary: z.string(),
      })
    ),
    generatedAt: z.string(),
  }),
});

type MatchResult = z.infer<typeof MatchResultSchema>;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Rate Limiting
    if (!user) {
      const cookieStore = await cookies();
      const guestSearchesStr = cookieStore.get("guest_searches")?.value || "0";
      const guestSearches = parseInt(guestSearchesStr, 10);
      
      if (guestSearches >= 3) {
        return NextResponse.json(
          { error: "Guest search limit reached", requiresLogin: true },
          { status: 429 }
        );
      }
      
      cookieStore.set("guest_searches", (guestSearches + 1).toString(), {
        maxAge: 60 * 60 * 24, // 24 hours
        httpOnly: true,
      });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from("search_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString());
        
      if (!error && count !== null && count >= 20) {
        return NextResponse.json(
          { error: "Daily search limit reached" },
          { status: 429 }
        );
      }
    }

    // 1. Parse & validate the request body
    const body = await request.json();
    const parsed = QuizRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { region, distributionPolicy, esgStatus, riskPreference, sectorTilt } =
      parsed.data;
    const allEtfs = etfs as unknown as ETF[];

    // 2. Deterministic pre-filter (+ risk-based re-ranking + sector tilt)
    const candidates = filterCandidates(
      allEtfs,
      region,
      distributionPolicy,
      esgStatus,
      riskPreference,
      sectorTilt,
    );

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No ETFs matched your criteria. Try adjusting your filters." },
        { status: 404 },
      );
    }

    // 3. Build the prompt & call the LLM
    const candidatesText = candidates.map(describeEtf).join("\n");

    const MatchesOnlySchema = MatchResultSchema.pick({ matches: true });

    const prompt = `You are an expert ETF advisor. A user has answered a short quiz with these preferences:

- Preferred region: ${region === "world" ? "World / Global" : region === "us" ? "United States" : region === "europe" ? "Europe" : "Emerging Markets"}
- Distribution policy: ${distributionPolicy === "acc" ? "Accumulating (reinvest dividends)" : "Distributing (pay out dividends)"}
- ESG preference: ${esgStatus === "none" ? "No ESG preference" : esgStatus === "article_8" ? "Article 8 – considers ESG factors" : "Article 9 – dedicated sustainable objective"}
- Risk preference: ${riskPreference === "low_vol" ? "Low volatility — minimise price swings" : riskPreference === "balanced" ? "Balanced — moderate risk & return" : "Maximum diversification — broadest spread across assets"}
- Sector tilt: ${sectorTilt === "none" ? "No preference — keep balanced across sectors" : sectorTilt === "tech" ? "Technology — favour tech-heavy ETFs" : sectorTilt === "dividend" ? "Dividend — favour ETFs with dividend / yield exposure" : "Healthcare — favour healthcare-heavy ETFs"}

Below are ${candidates.length} ETF candidates that match these constraints. Candidates are already ordered by how well they fit the risk preference (low_vol → lowest volatility first, max_div → most holdings first, balanced → best risk-adjusted return first) and then boosted by the sector tilt. Select the best 1-3 ETFs for this user and write a concise, 2-sentence rationale for each explaining exactly why it fits their specific answers.

Candidates:
${candidatesText}

Return only the selected ETFs with their ISIN, name, and rationale.`;

    let aiMatches: { isin: string; name: string; rationale: string; }[] = [];

    try {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: MatchesOnlySchema,
        prompt,
        temperature: 0.2,
      });
      aiMatches = object.matches;
    } catch (aiError) {
      console.warn("AI generation failed, falling back to deterministic matches:", aiError);
      aiMatches = candidates.slice(0, 3).map(c => ({
        isin: c.isin,
        name: c.name,
        rationale: "This ETF was selected based on a deterministic match of your quiz filters.",
      }));
    }

    // 4. Augment the matches with a session context the client can cache
    // so a follow-up LLM call (e.g. "explain this ETF in plain English")
    // can be answered without re-running the matching pipeline.
    const result: MatchResult = {
      matches: aiMatches,
      session: {
        answers: {
          region:
            region === "world"
              ? "World / Global"
              : region === "us"
                ? "United States"
                : region === "europe"
                  ? "Europe"
                  : "Emerging Markets",
          distributionPolicy:
            distributionPolicy === "acc"
              ? "Accumulating (reinvest dividends)"
              : "Distributing (pay out dividends)",
          esgStatus:
            esgStatus === "none"
              ? "No ESG preference"
              : esgStatus === "article_8"
                ? "Article 8 – considers ESG factors"
                : "Article 9 – dedicated sustainable objective",
          riskPreference:
            riskPreference === "low_vol"
              ? "Low volatility — minimise price swings"
              : riskPreference === "balanced"
                ? "Balanced — moderate risk & return"
                : "Maximum diversification — broadest spread across assets",
          sectorTilt:
            sectorTilt === "none"
              ? "No preference — keep balanced across sectors"
              : sectorTilt === "tech"
                ? "Technology — favour tech-heavy ETFs"
                : sectorTilt === "dividend"
                  ? "Dividend — favour ETFs with dividend / yield exposure"
                  : "Healthcare — favour healthcare-heavy ETFs",
        },
        candidates: candidates.map((etf) => ({
          isin: etf.isin,
          name: etf.name,
          summary: describeEtf(etf),
        })),
        generatedAt: new Date().toISOString(),
      },
    };

    if (user) {
      await supabase.from("search_history").insert({
        user_id: user.id,
        quiz_answers: parsed.data,
        matched_isins: aiMatches.map(m => m.isin),
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/match error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
