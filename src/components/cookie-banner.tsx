"use client";

import { useState, useEffect, useCallback } from "react";

const COOKIE_CONSENT_KEY = "etf-finder:cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  const handleAccept = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // ignore
    }
    setExiting(true);
    // Remove completely after the slide-down animation finishes
    setTimeout(() => {
      setVisible(false);
      setDismissed(true);
    }, 350);
  }, []);

  // Never render if already dismissed
  if (dismissed) return null;

  // Don't render until the initial delay has passed
  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-60 border-t border-border/60 bg-card/95 backdrop-blur-md transition-transform duration-350 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        exiting ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Diese Website verwendet nur technisch notwendige Cookies und
          Analyse-Cookies, um Ihr Nutzungserlebnis zu verbessern.{" "}
          <a
            href="https://appareo-digital.online/datenschutz.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Mehr in der Datenschutzerklärung
          </a>
        </p>
        <button
          onClick={handleAccept}
          className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
