"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ETFQuiz, type QuizAnswers } from "@/components/etf-quiz";
import { ETFChat } from "@/components/etf-chat";
import { ETFForYou } from "@/components/etf-for-you";
import { Toast } from "@/components/ui/toast";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { AuthDialog } from "@/components/auth/auth-dialog";

export default function Home() {
  const [step, setStep] = useState<"landing" | "quiz" | "results">("landing");
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const { toast, dismissToast } = useBookmarks();

  useEffect(() => {
    // Restore quiz answers from localStorage if they exist.
    // This handles both page refreshes and OAuth redirects.
    if (typeof window === "undefined") return;

    import("@/lib/quiz-storage").then(({ loadQuizAnswers }) => {
      const savedAnswers = loadQuizAnswers();
      if (savedAnswers) {
        setQuizAnswers(savedAnswers);
        setStep("results");
      }
    });

    // Clean up the OAuth resume flag if present.
    window.sessionStorage.removeItem("etf-finder:resume-after-auth");
  }, []);

  const handleQuizComplete = useCallback((answers: QuizAnswers) => {
    setQuizAnswers(answers);
    setStep("results");
  }, []);

  const handleReset = useCallback(() => {
    setStep("landing");
  }, []);

  return (
    <>
      <div className="flex flex-1 flex-col items-center w-full py-4 sm:py-12">
        <AnimatePresence mode="wait">
          {step === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex w-full max-w-lg flex-col items-center gap-3 text-center px-4 sm:px-0"
            >
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                ETF Finder
              </span>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
                Discover and compare ETFs
              </h1>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                A clean, minimal interface to explore exchange-traded
                funds. Answer a few questions to find the right ETF for
                your portfolio.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep("quiz")}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Get started
              </motion.button>

              {/* For You — curated ETF recommendations */}
              <div className="mt-10 w-full border-t border-border/50 pt-8">
                <ETFForYou />
              </div>
            </motion.div>
          )}

          {step === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="w-full px-4 sm:px-0 flex justify-center"
            >
              <ETFQuiz onComplete={handleQuizComplete} />
            </motion.div>
          )}

          {step === "results" && quizAnswers && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full flex-1 flex justify-center"
            >
              <ETFChat quizAnswers={quizAnswers} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Toast
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={dismissToast}
      />

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
