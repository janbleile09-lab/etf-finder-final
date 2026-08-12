// Safe browser-side storage for the user's quiz answers.
//
// We keep a local copy for anonymous users (so a page reload doesn't wipe
// their progress) and rely on Supabase for authenticated users. Both layers
// store the same serialisable shape so the file format is a single source
// of truth.

import type { QuizAnswers } from "@/components/etf-quiz";

const STORAGE_KEY = "etf-finder:quiz-answers:v1";

/**
 * The shape of what we persist. Currently identical to `QuizAnswers`, but
 * we keep a dedicated type so we can add metadata (e.g. timestamp) without
 * touching the quiz component.
 */
export interface PersistedQuizAnswers {
  answers: QuizAnswers;
  savedAt: string; // ISO-8601
}

function isComplete(
  answers: QuizAnswers,
): answers is Required<QuizAnswers> {
  return (
    answers.region !== null &&
    answers.distribution !== null &&
    answers.esg !== null &&
    answers.risk !== null &&
    answers.sectorTilt !== null
  );
}

/**
 * Read the most recent quiz answers from localStorage. Returns `null`
 * when nothing is stored, the payload is malformed, or `localStorage`
 * is unavailable (e.g. SSR, disabled cookies).
 */
export function loadQuizAnswers(): QuizAnswers | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedQuizAnswers> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;

    return parsed.answers as QuizAnswers;
  } catch {
    // Corrupt JSON or storage disabled — start fresh.
    return null;
  }
}

/**
 * Persist the current quiz answers to localStorage. Only fully completed
 * quizzes are stored — partial replies have no value to LLM follow-ups.
 */
export function saveQuizAnswers(answers: QuizAnswers): void {
  if (typeof window === "undefined") return;
  if (!isComplete(answers)) return;

  const payload: PersistedQuizAnswers = {
    answers,
    savedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — silently ignore; the user can
    // still see their results inside the session.
  }
}

/**
 * Remove the locally cached quiz answers. Used when the user logs out
 * or explicitly resets their profile.
 */
export function clearQuizAnswers(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing critical to clean up.
  }
}
