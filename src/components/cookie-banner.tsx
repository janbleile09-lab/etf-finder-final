"use client";

import { useState, useEffect, useCallback } from "react";
import { updateConsent } from "@/app/settings/actions";
import { useAuth } from "@/components/auth/auth-provider";

const COOKIE_CONSENT_KEY = "etf-finder:cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Check on mount — only run client-side
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        const timer = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable (SSR / incognito), skip banner
    }
  }, []);

  const handleAccept = useCallback(async () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
      if (user) {
        // Sync to Supabase profiles
        await updateConsent(true);
      }
    } catch {
      // ignore
    }
    setExiting(true);
    // Remove completely after the slide-down animation finishes
    setTimeout(() => {
      setVisible(false);
      setDismissed(true);
    }, 350);
  }, [user]);

  // Never render if already dismissed
  if (dismissed) return null;

  // Don't render until the initial delay has passed
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and Privacy Consent"
      className={`fixed bottom-0 left-0 right-0 z-60 border-t border-border/60 bg-card/95 backdrop-blur-md transition-transform duration-350 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        exiting ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">Cookie & Datenschutz</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Diese Website verwendet Cookies und verarbeitet Daten, um Ihr Nutzungserlebnis zu verbessern und KI-basierte Empfehlungen zu ermöglichen.{" "}
            <a
              href="https://appareo-digital.online/datenschutz.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Mehr in der Datenschutzerklärung
            </a>
          </p>
        </div>
        <button
          onClick={handleAccept}
          aria-label="Cookies und Datenverarbeitung akzeptieren"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          Akzeptieren & Verstanden
        </button>
      </div>
    </div>
  );
}
