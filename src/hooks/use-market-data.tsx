"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketDataQuote } from "@/lib/twelvedata";

/**
 * React hook that fetches live market data for a list of ETF ISINs.
 *
 * - Fetches from `/api/market-data` which checks Supabase cache first,
 *   then falls back to Twelve Data for fresh quotes.
 * - Automatically deduplicates and batches them into one request.
 * - Returns a Map of ISIN → MarketDataQuote for O(1) lookups.
 */

export interface ETFEntry {
  isin: string;
  name: string;
}

interface UseMarketDataResult {
  /** Map of ISIN → market quote. Only contains successfully fetched quotes. */
  quotes: Map<string, MarketDataQuote>;
  /** Whether any fetch is in progress. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;
}

export function useMarketData(etfs: ETFEntry[]): UseMarketDataResult {
  const [quotes, setQuotes] = useState<Map<string, MarketDataQuote>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of which ISINs we've already fetched to avoid redundant calls
  const fetchedRef = useRef<Set<string>>(new Set());
  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchQuotes = useCallback(async (etfsToFetch: ETFEntry[]) => {
    if (etfsToFetch.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/market-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etfs: etfsToFetch }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const freshMap = new Map<string, MarketDataQuote>();

      if (data.quotes) {
        for (const [isin, quote] of Object.entries(data.quotes)) {
          freshMap.set(isin, quote as MarketDataQuote);
        }
      }

      setQuotes((prev) => {
        const next = new Map(prev);
        for (const [isin, quote] of freshMap) {
          next.set(isin, quote);
        }
        return next;
      });

      // Mark as fetched
      for (const etf of etfsToFetch) {
        fetchedRef.current.add(etf.isin);
      }
    } catch (err) {
      console.error("useMarketData fetch error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Filter out already-fetched and invalid ISINs
    const newEtfs = etfs.filter(
      (etf) =>
        etf.isin &&
        etf.isin !== "N/A" &&
        !fetchedRef.current.has(etf.isin) &&
        !quotes.has(etf.isin),
    );

    if (newEtfs.length === 0) return;

    // Debounce: wait 300ms to batch multiple rapid updates
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchQuotes(newEtfs);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [etfs, quotes, fetchQuotes]);

  return { quotes, loading, error };
}
