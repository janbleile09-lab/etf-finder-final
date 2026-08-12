// localStorage cache for the latest `/api/match` response.
//
// We persist the *full* session context (quiz answers + candidate ETF
// summaries) so a future LLM call can answer follow-up questions like
// "explain this ETF in plain English" or "compare the two matches" without
// re-running the matching pipeline.

import type { QuizAnswers } from "@/components/etf-quiz";

const STORAGE_KEY = "etf-finder:match-session:v1";

/**
 * A single ETF entry as cached. Mirrors the server-side representation.
 */
export interface CachedCandidate {
  isin: string;
  name: string;
  summary: string;
}

/**
 * The human-readable session payload the server returns alongside the
 * matches. We keep this separate from the internal `match.rationale` so
 * the cache format is stable even if the LLM response shape changes.
 */
export interface CachedSession {
  answers: {
    region: string;
    distributionPolicy: string;
    esgStatus: string;
    riskPreference: string;
  };
  candidates: CachedCandidate[];
  generatedAt: string;
}

/**
 * The complete payload we cache per match run.
 */
export interface CachedMatchRun {
  matches: {
    isin: string;
    name: string;
    rationale: string;
  }[];
  session: CachedSession;
  rawAnswers: QuizAnswers;
  cachedAt: string;
}

/**
 * Persist the latest `/api/match` response so follow-up LLM calls can
 * re-use the candidates without re-fetching.
 */
export function cacheMatchRun(run: CachedMatchRun): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch {
    // Quota exceeded or storage disabled — silently ignore.
  }
}

/**
 * Load the most recent match run from localStorage. Returns `null` when
 * nothing is stored, the payload is malformed, or `localStorage` is
 * unavailable.
 */
export function loadMatchRun(): CachedMatchRun | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedMatchRun> | null;
    if (!parsed || !parsed.matches || !parsed.session) return null;
    return parsed as CachedMatchRun;
  } catch {
    return null;
  }
}

/**
 * Clear the cached match run. Used when the user resets their session.
 */
export function clearMatchRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
