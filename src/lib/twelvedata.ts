/**
 * Twelve Data API client for fetching real-time ETF market data.
 *
 * Strategy:
 *   1. Use /symbol_search with the ETF name to find the ticker symbol
 *   2. Use /quote with the ticker to get live market data
 *
 * Note: European ETFs (XETRA, Tradegate, etc.) require a Grow/Venture plan.
 * US-listed ETFs work on the free plan. The card gracefully degrades
 * when no market data is available.
 */

const TWELVE_DATA_BASE = "https://api.twelvedata.com";

/**
 * Exchange suffixes to try when searching by ISIN on Twelve Data.
 * XETRA (.DE), Tradegate (.TRG), Frankfurt (.F), LSE (.L)
 */

export interface MarketDataQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  open: number;
  previous_close: number;
  volume: number;
  currency: string;
  fifty_two_week: {
    high: number;
    low: number;
  };
  exchange: string;
  type: string;
  is_market_open: boolean;
  timestamp: number;
  updated_at: string; // ISO string
}

export interface TimeSeriesPoint {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeSeriesData {
  symbol: string;
  currency: string;
  points: TimeSeriesPoint[];
}

export interface MarketDataError {
  error: true;
  message: string;
}

export type MarketDataResult = MarketDataQuote | MarketDataError;

// In-memory cache for symbol search results (ETF name → ticker).
const symbolCache = new Map<string, string>();

/**
 * Search for a ticker symbol using the ETF name.
 * Caches results to avoid redundant API calls.
 */
async function findSymbol(apiKey: string, etfName: string): Promise<string | null> {
  const cached = symbolCache.get(etfName);
  if (cached) return cached;

  // Strip UCITS/ETF suffixes for cleaner search
  const searchTerm = etfName
    .replace(/\s*UCITS\s*ETF\s*\(.*?\)/gi, "")
    .replace(/\s*ETF\s*\(.*?\)/gi, "")
    .trim();

  try {
    const url = `${TWELVE_DATA_BASE}/symbol_search?symbol=${encodeURIComponent(searchTerm)}&outputsize=3&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "ok" || !data.data?.length) return null;

    // Prefer XETRA, Tradegate, Frankfurt, or LSE listings
    const preferred = data.data.find(
      (d: Record<string, string>) =>
        d.exchange === "XETR" ||
        d.exchange === "TRADEGATE" ||
        d.exchange === "FWB" ||
        d.exchange === "LSE",
    );

    const match = preferred ?? data.data[0];
    symbolCache.set(etfName, match.symbol);
    return match.symbol;
  } catch {
    return null;
  }
}

/**
 * Try to fetch a quote from Twelve Data using a symbol.
 */
async function tryQuote(
  apiKey: string,
  symbol: string,
): Promise<MarketDataQuote | null> {
  const url = `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const data = await res.json();

    // Invalid symbol or requires paid plan
    if (data.status === "error" || data.code) return null;

    // Must have a valid price (close or price field)
    const price = parseFloat(data.close ?? data.price) || 0;
    if (price === 0) return null;

    return {
      symbol: data.symbol ?? symbol,
      name: data.name ?? "",
      price,
      change: parseFloat(data.change) || 0,
      change_percent: parseFloat(data.percent_change) || 0,
      high: parseFloat(data.high) || 0,
      low: parseFloat(data.low) || 0,
      open: parseFloat(data.open) || 0,
      previous_close: parseFloat(data.previous_close) || 0,
      volume: parseInt(data.volume, 10) || 0,
      currency: data.currency ?? "EUR",
      fifty_two_week: {
        high: parseFloat(data.fifty_two_week?.high) || 0,
        low: parseFloat(data.fifty_two_week?.low) || 0,
      },
      exchange: data.exchange ?? "",
      type: data.type ?? "ETF",
      is_market_open: data.is_market_open ?? false,
      timestamp: data.timestamp ?? Date.now(),
      updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a market data quote for an ETF by its ISIN and name.
 */
export async function fetchQuote(
  apiKey: string,
  isin: string,
  etfName: string,
): Promise<MarketDataResult> {
  if (!isin || isin === "N/A" || !apiKey) {
    return { error: true, message: "Invalid parameters" };
  }

  const symbol = await findSymbol(apiKey, etfName);
  if (!symbol) {
    return { error: true, message: `No ticker found for: ${etfName}` };
  }

  const quote = await tryQuote(apiKey, symbol);
  if (!quote) {
    return {
      error: true,
      message: `No quote for ${symbol} (European exchanges require a paid plan)`,
    };
  }

  return quote;
}

/**
 * Fetch quotes for multiple ETFs sequentially (respects rate limits).
 */
export async function fetchQuotes(
  apiKey: string,
  etfs: { isin: string; name: string }[],
): Promise<Map<string, MarketDataQuote>> {
  const results = new Map<string, MarketDataQuote>();

  const unique = [
    ...new Map(
      etfs.filter((e) => e.isin && e.isin !== "N/A").map((e) => [e.isin, e]),
    ).values(),
  ];

  if (unique.length === 0) return results;

  for (const etf of unique) {
    const result = await fetchQuote(apiKey, etf.isin, etf.name);
    if (result && !("error" in result)) {
      results.set(etf.isin, result);
    }
    // Small delay to respect rate limits (8/min on free plan)
    if (unique.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

/**
 * Fetch time series data for an ETF (last 30 days, daily).
 * Uses the symbol found via name search.
 */
export async function fetchTimeSeries(
  apiKey: string,
  isin: string,
  etfName: string,
): Promise<TimeSeriesData | null> {
  if (!isin || isin === "N/A" || !apiKey) return null;

  const symbol = await findSymbol(apiKey, etfName);
  if (!symbol) return null;

  try {
    const url = `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=30&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) return null;

    const data = await res.json();

    if (data.status === "error" || !data.values) return null;

    const points: TimeSeriesPoint[] = data.values
      .map((v: Record<string, string>) => ({
        datetime: v.datetime,
        open: parseFloat(v.open) || 0,
        high: parseFloat(v.high) || 0,
        low: parseFloat(v.low) || 0,
        close: parseFloat(v.close) || 0,
        volume: parseInt(v.volume, 10) || 0,
      }))
      .filter((p: TimeSeriesPoint) => p.close > 0)
      .reverse(); // chronological order

    if (points.length < 2) return null;

    return {
      symbol: data.meta?.symbol ?? symbol,
      currency: data.meta?.currency ?? "EUR",
      points,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch time series for multiple ETFs sequentially.
 */
export async function fetchTimeSeriesForEtfs(
  apiKey: string,
  etfs: { isin: string; name: string }[],
): Promise<Map<string, TimeSeriesData>> {
  const results = new Map<string, TimeSeriesData>();

  const unique = [
    ...new Map(
      etfs.filter((e) => e.isin && e.isin !== "N/A").map((e) => [e.isin, e]),
    ).values(),
  ];

  for (const etf of unique) {
    const data = await fetchTimeSeries(apiKey, etf.isin, etf.name);
    if (data) {
      results.set(etf.isin, data);
    }
    if (unique.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
