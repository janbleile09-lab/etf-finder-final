import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextRequest } from "next/server";
import etfs from "../../../../public/data/etfs.json";
import type { ETF } from "../../../../types/etf";
import {
  scoreCandidates,
  describeScoredEtf,
  describeEtf,
  type ScoredETF,
} from "@/lib/etf-filter";
import { enrichMultipleETFs, type EnrichedETFData } from "@/lib/tavily-search";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

// ---------------------------------------------------------------------------
// System prompt — SMART ADVISOR with Scoring Engine
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_HEADER = `Du bist ein ETF-Berater. Deine Datenbasis: Eine Scoring-Engine hat die besten ETFs aus der Datenbank für den Nutzer vorausgewählt und mit einem 0–100 Match-Score bewertet. Deine Aufgabe ist es, diese Vorauswahl zu präsentieren und zu erklären.

## SO FUNKTIONIERT DER MATCH-SCORE (100 = perfekte Übereinstimmung):
- Region (0–25): Wie gut passt die Region?
- Ausschüttung (0–15): Thesaurierend vs. Ausschüttend
- ESG (0–20): Wie gut passt der ESG-Status? (Artikel 9 ist STRENGER als Artikel 8 — wenn der Nutzer Artikel 8 will, ist Artikel 9 ein Upgrade und bekommt fast volle Punktzahl)
- Risiko (0–20): Wie gut passt die Volatilität / Diversifikation?
- Sektor (0–20): Wie gut passt der Sektor-Fokus?

## REGELN:
1. **Daten aus der Vorauswahl verwenden:** Jede Zahl, ISIN, WKN, Rendite, Volatilität MUSS aus den unten stehenden Daten stammen.
2. **Score-Erklärung:** Erkläre bei jedem ETF, WARUM er den Score hat. Wo passt er perfekt? Wo gibt es Abweichungen?
3. **ESG-Upgrade erklären:** Wenn der Nutzer Artikel 8 will und ein ETF Artikel 9 hat: Sag "Dieser ETF hat Artikel 9 — das ist sogar strenger als Ihr gewünschter Artikel 8. Sie bekommen mehr ESG, als Sie wollten."
4. **Keine Erfindungen:** Keine Fondsgrößen, Auflagedaten oder andere Werte erfinden, die nicht in den Daten stehen.
5. **Web-Daten ergänzen:** Wenn Web-Recherche-Daten vorhanden sind, nutze sie für aktuelle Zahlen (Fondsvolumen, Top-Holdings).
6. **Persönlich:** Sprich den Nutzer direkt an. Erkläre, warum ein ETF zu SEINEN Präferenzen passt.
7. **Kein Marketing-Blabla:** Sachlich, präzise, faktenorientiert.

## ANTWORT-FORMAT:

Beginne mit 1–2 persönlichen Sätzen, die die Präferenzen des Nutzers anerkennen.

Dann für die Top-3 ETFs:

### 🏆 ETF-Name — ISIN: IE00... | Match: XX/100

| Merkmal | Wert |
|---|---|
| ISIN | ... |
| WKN | ... |
| TER | ... |
| Ausschüttung | ... |
| ESG | ... |
| 1Y Rendite | ... |
| 3Y Rendite | ... |
| 1Y Volatilität | ... |
| Fondsvolumen | (aus Web-Recherche, sonst "k.A.") |

**📋 Score-Analyse:** Gehe die 5 Kategorien durch und erkläre, warum der ETF diesen Score hat.

**📊 Sektoren & Holdings:** Nenne die Top-Sektoren und Top-Holdings (aus Datenbank oder Web-Recherche).

Nach allen Empfehlungen: "Hinweis: Dies ist keine Anlageberatung. Daten aus der ETF-Datenbank und offiziellen Quellen, ohne Gewähr."`;

// ---------------------------------------------------------------------------
// Helper: Map quiz answers from client format to filter format
// ---------------------------------------------------------------------------

function mapRegion(region: string | null): string {
  switch (region) {
    case "world": return "world";
    case "usa": return "us";
    case "europe": return "europe";
    case "emerging": return "emerging_markets";
    default: return "world";
  }
}

function mapDistribution(dist: string | null): "acc" | "dist" {
  return dist === "dist" ? "dist" : "acc";
}

function mapEsg(esg: string | null): "none" | "article_8" | "article_9" {
  if (esg === "article_8") return "article_8";
  if (esg === "article_9") return "article_9";
  return "none";
}

function mapRisk(risk: string | null): "low_vol" | "balanced" | "max_div" {
  if (risk === "low_vol") return "low_vol";
  if (risk === "max_div") return "max_div";
  return "balanced";
}

function mapSectorTilt(tilt: string | null): "none" | "tech" | "dividend" | "healthcare" {
  if (tilt === "tech") return "tech";
  if (tilt === "dividend") return "dividend";
  if (tilt === "healthcare") return "healthcare";
  return "none";
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { messages, quizAnswers, session } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allEtfs = etfs as unknown as ETF[];

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Scoring Engine — alle 599 ETFs werden gescored
    // ═══════════════════════════════════════════════════════════════════

    let scoredCandidates: ScoredETF[];
    let candidatesText: string;

    if (session?.candidates?.length) {
      // Client sent cached match session
      const candidateIsins = new Set(session.candidates.map((c: { isin: string }) => c.isin));
      const matched = allEtfs.filter((e) => candidateIsins.has(e.isin));
      // Score these against quiz answers
      if (quizAnswers && Object.values(quizAnswers).some((v) => v !== null)) {
        scoredCandidates = scoreCandidates(
          matched,
          mapRegion(quizAnswers.region),
          mapDistribution(quizAnswers.distribution),
          mapEsg(quizAnswers.esg),
          mapRisk(quizAnswers.risk),
          mapSectorTilt(quizAnswers.sectorTilt),
        );
      } else {
        scoredCandidates = matched.slice(0, 10).map((e) => ({
          etf: e, score: 100,
          breakdown: { region: 25, distribution: 15, esg: 20, risk: 20, tilt: 20 },
        }));
      }
      // ONLY take top 10 for prompt
      scoredCandidates = scoredCandidates.slice(0, 10);
      candidatesText = scoredCandidates.map(describeScoredEtf).join("\n\n---\n\n");
    } else if (quizAnswers && Object.values(quizAnswers).some((v) => v !== null)) {
      // Score ALL ETFs against the quiz answers
      scoredCandidates = scoreCandidates(
        allEtfs,
        mapRegion(quizAnswers.region),
        mapDistribution(quizAnswers.distribution),
        mapEsg(quizAnswers.esg),
        mapRisk(quizAnswers.risk),
        mapSectorTilt(quizAnswers.sectorTilt),
      );
      // ONLY take top 10 for prompt
      scoredCandidates = scoredCandidates.slice(0, 10);
      candidatesText = scoredCandidates.map(describeScoredEtf).join("\n\n---\n\n");
    } else {
      // No quiz context — send top 10 ETFs compact
      scoredCandidates = allEtfs.slice(0, 10).map((e) => ({
        etf: e, score: 100,
        breakdown: { region: 25, distribution: 15, esg: 20, risk: 20, tilt: 20 },
      }));
      candidatesText = allEtfs.slice(0, 10).map(describeEtf).join("\n");
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Web-Search für die Top-3 Scored ETFs
    // ═══════════════════════════════════════════════════════════════════

    let enrichmentText = "";

    if (scoredCandidates.length > 0) {
      const topIsins = scoredCandidates
        .slice(0, 3)
        .map((s) => s.etf.isin)
        .filter((isin) => isin !== "N/A");

      if (topIsins.length > 0) {
        try {
          const enrichmentPromise = enrichMultipleETFs(topIsins);
          const timeoutPromise = new Promise<Map<string, EnrichedETFData>>((resolve) => {
            setTimeout(() => resolve(new Map()), 3000);
          });

          const enrichmentData = await Promise.race([enrichmentPromise, timeoutPromise]);

          if (enrichmentData.size > 0) {
            const lines: string[] = [];
            for (const [isin, data] of enrichmentData) {
              const scored = scoredCandidates.find((s) => s.etf.isin === isin);
              if (!scored) continue;
              const e = scored.etf;
              const parts: string[] = [`Web-Recherche für ${e.name} (${isin}):`];
              if (data.topHoldings) parts.push(`  Top-Holdings: ${data.topHoldings}`);
              if (data.aum) parts.push(`  Fondsvolumen: ${data.aum}`);
              if (data.dailyPrice) parts.push(`  Tageskurs: ${data.dailyPrice}`);
              if (data.inceptionDate) parts.push(`  Auflagedatum: ${data.inceptionDate}`);
              lines.push(parts.join("\n"));
            }
            enrichmentText = lines.join("\n\n");
          }
        } catch (err) {
          console.warn("Tavily enrichment failed:", err);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Build prompt & stream
    // ═══════════════════════════════════════════════════════════════════

    let systemPrompt = SYSTEM_PROMPT_HEADER;

    systemPrompt += `\n\n## VORAUSWAHL (Top ${scoredCandidates.length} ETFs, sortiert nach Match-Score):\n\n${candidatesText}`;

    if (enrichmentText) {
      systemPrompt += `\n\n---\n\n## 📡 WEB-RECHERCHE (aktuelle Daten):\n\n${enrichmentText}`;
    }

    if (quizAnswers && Object.values(quizAnswers).some((v) => v !== null)) {
      systemPrompt += `\n\n## NUTZER-PRÄFERENZEN:\n- Region: ${quizAnswers.region}\n- Ausschüttung: ${quizAnswers.distribution}\n- ESG: ${quizAnswers.esg}\n- Risiko: ${quizAnswers.risk}\n- Sektor-Fokus: ${quizAnswers.sectorTilt}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelMessages = messages.map((m: any) => ({
      role: m.role as "user" | "assistant" | "system",
      content: typeof m.content === "string"
        ? m.content
        : Array.isArray(m.parts)
          ? m.parts.map((p: { text?: string }) => p.text ?? "").join("")
          : "",
    }));

    const result = streamText({
      model: nvidia.chat("nvidia/nemotron-3-ultra-550b-a55b"),
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
