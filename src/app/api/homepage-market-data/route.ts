/**
 * Homepage Market Data API
 *
 * Fetches live quotes + 90-day time series for the 6 recommended ETFs
 * using Yahoo Finance (free, no API key, supports European XETRA tickers).
 *
 * GET /api/homepage-market-data
 * Client refreshes every 10 min via ETFForYou.
 */

import { NextResponse } from "next/server";

/* ── Yahoo Finance ──────────────────────────────────────────── */

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

/** ISIN → XETRA ticker (Yahoo uses .DE suffix for XETRA listings) */
const ISIN_TO_TICKER: Record<string, string> = {
  IE00B4L5Y983: "EUNL.DE",
  IE00B5BMR087: "SXR8.DE",
  IE00BDZZTM54: "2B7J.DE",
  IE00B53SZB19: "SXRV.DE",
  IE00B4ND3602: "PPFB.DE",
  DE000A0F5UH1: "ISPA.DE",
};

/** WKN fallback in case XETRA ticker doesn't resolve */
const ISIN_TO_WKN: Record<string, string> = {
  IE00B4L5Y983: "A0RPWH",
  IE00B5BMR087: "A0YEDG",
  IE00BDZZTM54: "A2DX7X",
  IE00B53SZB19: "A0YEDL",
  IE00B4ND3602: "A1KWPQ",
  DE000A0F5UH1: "A0F5UH",
};

/* ── Response shapes (compatible with what ETFForYou expects) ── */

export interface HomepageQuote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
}

export interface HomepagePoint {
  datetime: string;
  close: number;
}

export interface HomepageSeries {
  symbol: string;
  currency: string;
  points: HomepagePoint[];
}

async function fetchFromYahoo(
  symbol: string,
): Promise<{ quote: HomepageQuote | null; series: HomepageSeries | null }> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return { quote: null, series: null };

    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r?.meta) return { quote: null, series: null };

    const m = r.meta;
    const price = m.regularMarketPrice ?? 0;
    const prev = m.chartPreviousClose ?? 0;

    const quote: HomepageQuote = {
      symbol: m.symbol ?? symbol,
      price,
      change: price - prev,
      change_percent: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      currency: m.currency ?? "EUR",
    };

    // Time series
    const timestamps: number[] = r.timestamp ?? [];
    const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const len = Math.min(timestamps.length, closes.length);
    const pts: HomepagePoint[] = [];

    for (let i = 0; i < len; i++) {
      const c = closes[i];
      if (c !== null && c !== undefined) {
        pts.push({
          datetime: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
          close: c,
        });
      }
    }

    const series: HomepageSeries | null =
      pts.length >= 2
        ? { symbol: m.symbol ?? symbol, currency: m.currency ?? "EUR", points: pts }
        : null;

    return { quote, series };
  } catch {
    return { quote: null, series: null };
  }
}

/* ── GET handler ────────────────────────────────────────────── */

export async function GET() {
  const isins = Object.keys(ISIN_TO_TICKER);

  const results = await Promise.all(
    isins.map(async (isin) => {
      let r = await fetchFromYahoo(ISIN_TO_TICKER[isin]);
      if (!r.quote && ISIN_TO_WKN[isin]) {
        const fallback = `${ISIN_TO_WKN[isin]}.DE`;
        if (fallback !== ISIN_TO_TICKER[isin]) {
          r = await fetchFromYahoo(fallback);
        }
      }
      return { isin, ...r };
    }),
  );

  const quotes: Record<string, HomepageQuote> = {};
  const timeSeries: Record<string, HomepageSeries> = {};

  for (const { isin, quote, series } of results) {
    if (quote) quotes[isin] = quote;
    if (series) timeSeries[isin] = series;
  }

  return NextResponse.json({
    quotes,
    timeSeries,
    updatedAt: new Date().toISOString(),
  });
}
