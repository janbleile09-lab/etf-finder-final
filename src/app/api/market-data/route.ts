import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQuotes, type MarketDataQuote } from "@/lib/twelvedata";

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY!;

// Cache TTL: re-fetch if data is older than 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { etfs } = (await req.json()) as {
      etfs: { isin: string; name: string }[];
    };

    if (!Array.isArray(etfs) || etfs.length === 0) {
      return NextResponse.json(
        { error: "etfs must be a non-empty array of { isin, name }" },
        { status: 400 },
      );
    }

    if (etfs.length > 50) {
      return NextResponse.json(
        { error: "Too many ETFs requested. Maximum is 50." },
        { status: 400 },
      );
    }

    // Filter valid entries
    const validEtfs = etfs.filter(
      (e) =>
        typeof e.isin === "string" &&
        e.isin.length === 12 &&
        e.isin !== "N/A",
    );

    if (validEtfs.length === 0) {
      return NextResponse.json({ quotes: {} });
    }

    const validIsins = validEtfs.map((e) => e.isin);

    const supabase = await createClient();

    // ── Step 1: Check Supabase cache ──
    const { data: cachedRows, error: cacheError } = await supabase
      .from("etf_market_data")
      .select("*")
      .in("isin", validIsins);

    if (cacheError) {
      console.error("Supabase cache read error:", cacheError);
    }

    const cachedMap = new Map<string, MarketDataQuote>();
    const cacheCutoff = Date.now() - CACHE_TTL_MS;

    if (cachedRows) {
      for (const row of cachedRows) {
        const updatedAt = new Date(row.updated_at).getTime();
        if (updatedAt > cacheCutoff) {
          cachedMap.set(row.isin, {
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            change: row.change_absolute,
            change_percent: row.change_percent,
            high: row.high,
            low: row.low,
            open: row.open_price,
            previous_close: row.previous_close,
            volume: row.volume,
            currency: row.currency,
            fifty_two_week: {
              high: row.fifty_two_week_high,
              low: row.fifty_two_week_low,
            },
            exchange: row.exchange ?? "",
            type: "ETF",
            is_market_open: false,
            timestamp: new Date(row.updated_at).getTime(),
            updated_at: row.updated_at,
          });
        }
      }
    }

    // ── Step 2: Fetch missing/expired from Twelve Data ──
    const missingEtfs = validEtfs.filter((e) => !cachedMap.has(e.isin));

    let freshMap = new Map<string, MarketDataQuote>();

    if (missingEtfs.length > 0) {
      freshMap = await fetchQuotes(TWELVE_DATA_API_KEY, missingEtfs);

      // ── Step 3: Save fresh data back to Supabase ──
      if (freshMap.size > 0) {
        const rowsToUpsert = Array.from(freshMap.entries()).map(
          ([isin, quote]) => ({
            isin,
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change_absolute: quote.change,
            change_percent: quote.change_percent,
            high: quote.high,
            low: quote.low,
            open_price: quote.open,
            previous_close: quote.previous_close,
            volume: quote.volume,
            currency: quote.currency,
            fifty_two_week_high: quote.fifty_two_week.high,
            fifty_two_week_low: quote.fifty_two_week.low,
            exchange: quote.exchange,
            updated_at: new Date().toISOString(),
          }),
        );

        const { error: upsertError } = await supabase
          .from("etf_market_data")
          .upsert(rowsToUpsert, { onConflict: "isin" });

        if (upsertError) {
          console.error("Supabase cache write error:", upsertError);
        }
      }
    }

    // ── Step 4: Merge cached + fresh, return all ──
    const allQuotes: Record<string, MarketDataQuote> = {};

    for (const [isin, quote] of cachedMap) {
      allQuotes[isin] = quote;
    }
    for (const [isin, quote] of freshMap) {
      allQuotes[isin] = quote;
    }

    return NextResponse.json({ quotes: allQuotes });
  } catch (error) {
    console.error("Market data API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 },
    );
  }
}
