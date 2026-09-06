"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadQuizAnswers,
  saveQuizAnswers,
} from "@/lib/quiz-storage";
import {
  loadQuizAnswersServer,
  persistQuizAnswersServer,
} from "@/lib/quiz-answers-store";
import { useAuth } from "@/components/auth/auth-provider";

/* ── Quiz data ──────────────────────────────────────────────── */

export type Region = "world" | "usa" | "europe" | "emerging";
export type Distribution = "acc" | "dist";
export type Esg = "any" | "article_8" | "article_9";
export type Risk = "low_vol" | "balanced" | "max_div";
// A "tilt" is a voluntary sector preference rather than a hard filter: we
// boost ETFs that match it, but never drop ones that don't.
export type SectorTilt = "none" | "tech" | "dividend" | "healthcare";

export interface QuizAnswers {
  region: Region | null;
  distribution: Distribution | null;
  esg: Esg | null;
  risk: Risk | null;
  sectorTilt: SectorTilt | null;
}

interface StepDefinition {
  key: keyof QuizAnswers;
  question: string;
  description: string;
  options: { value: string; label: string; description?: string }[];
}

const STEPS: StepDefinition[] = [
  {
    key: "region",
    question: "Investment Region",
    description: "Which market do you want exposure to?",
    options: [
      { value: "world", label: "World", description: "Global diversification" },
      { value: "usa", label: "USA", description: "S&P 500 & US equities" },
      { value: "europe", label: "Europe", description: "STOXX 600 & EU markets" },
      { value: "emerging", label: "Emerging Markets", description: "Higher growth potential" },
    ],
  },
  {
    key: "distribution",
    question: "Distribution Preference",
    description: "How should dividends be handled?",
    options: [
      { value: "acc", label: "Accumulating", description: "Dividends automatically reinvested" },
      { value: "dist", label: "Distributing", description: "Dividends paid out as income" },
    ],
  },
  {
    key: "esg",
    question: "ESG Focus",
    description: "Do you want sustainability criteria applied?",
    options: [
      { value: "any", label: "Any", description: "No ESG restrictions" },
      { value: "article_8", label: "Article 8 / ESG", description: "Promotes environmental & social characteristics" },
      { value: "article_9", label: "Article 9 / SRI", description: "Sustainable investment objective" },
    ],
  },
  {
    key: "risk",
    question: "Risk Preference",
    description: "How do you want to manage volatility?",
    options: [
      { value: "low_vol", label: "Low Volatility", description: "Minimise price swings" },
      { value: "balanced", label: "Balanced", description: "Moderate risk & return" },
      { value: "max_div", label: "Maximum Diversification", description: "Broadest spread across assets" },
    ],
  },
  {
    key: "sectorTilt",
    question: "Sector Focus",
    description: "Optional: tilt your portfolio toward a specific theme.",
    options: [
      { value: "none", label: "No Preference", description: "Balanced across all sectors" },
      { value: "tech", label: "Technology Tilt", description: "Favour tech-heavy ETFs" },
      { value: "dividend", label: "Dividend Tilt", description: "Favour ETFs with higher yield / dividend payers" },
      { value: "healthcare", label: "Healthcare Tilt", description: "Favour healthcare-heavy ETFs" },
    ],
  },
];

/* ── Spring config (snappy, defined once) ───────────────────── */

const SPRING = { type: "spring" as const, stiffness: 400, damping: 28 };

/* ── Step variant (fade + 6px vertical slide) ────────────────── */

const stepVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? 6 : -6,
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? -6 : 6,
  }),
};

/* ── Hook: keyboard navigation ───────────────────────────────── */

function useKeyboardNav(
  optionsCount: number,
  onSelect: (index: number) => void,
  onBack: () => void,
  enabled: boolean,
) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setFocusIndex(-1), 0);
  }, [optionsCount]);

  useEffect(() => {
    if (!enabled) return;

    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          setFocusIndex((prev) => (prev + 1) % optionsCount);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          setFocusIndex((prev) => (prev - 1 + optionsCount) % optionsCount);
          break;
        case "Enter":
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < optionsCount) {
            onSelect(focusIndex);
          }
          break;
        case "Backspace":
          e.preventDefault();
          onBack();
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [optionsCount, onSelect, onBack, enabled, focusIndex]);

  return { focusIndex, setFocusIndex, ref };
}

/* ── Option card (motion-aware press + hover) ────────────────── */

interface OptionCardProps {
  option: { value: string; label: string; description?: string };
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onHover: () => void;
}

function OptionCard({
  option,
  isSelected,
  isFocused,
  onClick,
  onHover,
}: OptionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      /* ── Snappy spring on hover ──────────────────────────── */
      whileHover={
        shouldReduceMotion
          ? undefined
          : { scale: 1.01, transition: SPRING }
      }
      whileTap={
        shouldReduceMotion
          ? undefined
          : { scale: 0.98, transition: SPRING }
      }
      className={cn(
        /* Shared */
        "relative flex w-full items-start gap-3 sm:gap-4 rounded-xl border p-4 sm:px-5 sm:py-4 text-left",
        "transition-colors duration-150 ease-out",
        "outline-none select-none",
        /* Selected */
        isSelected
          ? "border-primary/30 bg-primary/4 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]"
          : "border-border bg-card shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] hover:border-foreground/15 hover:shadow-[0_1px_3px_0_rgb(0_0_0/0.05)]",
        /* Focus ring */
        isFocused &&
          "ring-2 ring-ring/50 ring-offset-1 ring-offset-background",
      )}
    >
      {/* Radio indicator */}
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-transparent",
        )}
      >
        {isSelected && <Check className="size-2.5" strokeWidth={3} />}
      </span>

      {/* Label & description */}
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium leading-snug text-foreground">
          {option.label}
        </span>
        {option.description && (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {option.description}
          </span>
        )}
      </span>
    </motion.button>
  );
}

/* ── Progress indicator ─────────────────────────────────────── */

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-300 ease-out",
            i <= current
              ? "bg-primary w-6"
              : "bg-muted w-3",
          )}
        />
      ))}
    </div>
  );
}

/* ── Main quiz component ────────────────────────────────────── */

export interface ETFQuizProps {
  onComplete: (answers: QuizAnswers) => void;
}

export function ETFQuiz({ onComplete }: ETFQuizProps) {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({
    region: null,
    distribution: null,
    esg: null,
    risk: null,
    sectorTilt: null,
  });

  // Hydrate answers from localStorage (always) and Supabase (when logged in).
  // localStorage is the optimistic source so the user sees their pre-fill
  // even if Supabase is slow; the server copy wins when it eventually
  // resolves, but only if the user has answered a *full* quiz on it.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const local = loadQuizAnswers();
      if (local && !cancelled) {
        setAnswers(local);
      }

      if (user?.id) {
        const remote = await loadQuizAnswersServer(user.id);
        if (!cancelled && remote && remote.region !== null) {
          setAnswers(remote);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const currentStep = STEPS[step];
  const currentAnswer = answers[currentStep.key];

  const handleSelect = useCallback(
    (value: string) => {
      // Compute the would-be next state so we can persist + emit on the
      // final step without depending on the async setState callback.
      const nextAnswers: QuizAnswers = {
        ...answers,
        [currentStep.key]: value,
      };
      setAnswers(nextAnswers);

      if (step < STEPS.length - 1) {
        setDirection(1);
        setStep((s) => s + 1);
      } else {
        // Last step — fire onComplete with all answers and persist.
        saveQuizAnswers(nextAnswers);
        if (user?.id) {
          // Fire and forget; persistence is best-effort.
          persistQuizAnswersServer(user.id, nextAnswers);
        }
        onComplete(nextAnswers);
      }
    },
    [step, currentStep.key, answers, onComplete, user],
  );

  const handleBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const { focusIndex, setFocusIndex, ref } = useKeyboardNav(
    currentStep.options.length,
    (index) => handleSelect(currentStep.options[index].value),
    handleBack,
    true,
  );

  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex w-full max-w-md flex-col gap-6" ref={ref}>
      {/* ── Header: progress + step count ────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground tabular-nums tracking-wide">
          Step {step + 1} of {STEPS.length}
        </span>
        <ProgressBar current={step} total={STEPS.length} />
      </div>

      {/* ── Animated step content ────────────────────────────── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep.key}
          custom={direction}
          variants={shouldReduceMotion ? undefined : stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={
            shouldReduceMotion
              ? { duration: 0.15 }
              : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
          }
          className="flex flex-col gap-4"
        >
          {/* Question text */}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">
              {currentStep.question}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {currentStep.description}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2.5">
            {currentStep.options.map((option, i) => (
              <OptionCard
                key={option.value}
                option={option}
                isSelected={currentAnswer === option.value}
                isFocused={focusIndex === i}
                onClick={() => handleSelect(option.value)}
                onHover={() => setFocusIndex(i)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Footer: back button (hidden on step 0) ───────────── */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex size-5 items-center justify-center rounded border border-border text-[10px]">
            ↵
          </span>
          <span>to select</span>
          {step > 0 && (
            <>
              <span className="inline-flex size-5 items-center justify-center rounded border border-border text-[10px]">
                ⌫
              </span>
              <span>back</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
