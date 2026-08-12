// Supabase persistence for quiz answers.
//
// Schema expected (run once in the Supabase SQL editor):
//
//   create table user_quiz_sessions (
//     user_id     uuid primary key references auth.users(id) on delete cascade,
//     region      text not null,
//     distribution text not null,
//     esg         text not null,
//     risk        text not null,
//     sector_tilt text not null,
//     updated_at  timestamptz not null default now()
//   );
//
//   alter table user_quiz_sessions enable row level security;
//
//   create policy "Users can read their own quiz answers"
//     on user_quiz_sessions for select
//     using (auth.uid() = user_id);
//
//   create policy "Users can upsert their own quiz answers"
//     on user_quiz_sessions for insert with check (auth.uid() = user_id);
//
//   create policy "Users can update their own quiz answers"
//     on user_quiz_sessions for update using (auth.uid() = user_id);

import { createClient } from "@/lib/supabase/client";
import type { QuizAnswers } from "@/components/etf-quiz";

interface QuizRow {
  user_id: string;
  region: string;
  distribution: string;
  esg: string;
  risk: string;
  sector_tilt: string;
}

type CompleteAnswers = {
  [K in keyof QuizAnswers]: NonNullable<QuizAnswers[K]>;
};

/**
 * Type-guard: returns `true` when every quiz answer is filled in.
 */
export function isCompleteQuizAnswers(
  answers: QuizAnswers,
): answers is CompleteAnswers {
  return (
    answers.region !== null &&
    answers.distribution !== null &&
    answers.esg !== null &&
    answers.risk !== null &&
    answers.sectorTilt !== null
  );
}

/**
 * Serialize a `QuizAnswers` value for the database. Caller guarantees
 * the answers are complete via `isCompleteQuizAnswers`.
 */
function toRow(userId: string, answers: CompleteAnswers): QuizRow {
  return {
    user_id: userId,
    region: answers.region,
    distribution: answers.distribution,
    esg: answers.esg,
    risk: answers.risk,
    sector_tilt: answers.sectorTilt,
  };
}

/**
 * Upsert the current quiz answers for the given user. Returns the stored
 * row on success, or `null` when the user is anonymous, the answers are
 * incomplete, or Supabase rejects the write (we never throw — persistence
 * is best-effort and the UI must keep working).
 */
export async function persistQuizAnswersServer(
  userId: string,
  answers: QuizAnswers,
): Promise<QuizRow | null> {
  if (!userId) return null;
  if (!isCompleteQuizAnswers(answers)) return null;

  const row = toRow(userId, answers);

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_quiz_sessions")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();

    if (error || !data) return null;
    return data as QuizRow;
  } catch {
    return null;
  }
}

/**
 * Load the most recent quiz answers for the given user. Returns `null`
 * for anonymous users, missing rows, or Supabase errors.
 */
export async function loadQuizAnswersServer(
  userId: string,
): Promise<QuizAnswers | null> {
  if (!userId) return null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_quiz_sessions")
      .select("region, distribution, esg, risk, sector_tilt")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      region: data.region as QuizAnswers["region"],
      distribution: data.distribution as QuizAnswers["distribution"],
      esg: data.esg as QuizAnswers["esg"],
      risk: data.risk as QuizAnswers["risk"],
      sectorTilt: data.sector_tilt as QuizAnswers["sectorTilt"],
    };
  } catch {
    return null;
  }
}
