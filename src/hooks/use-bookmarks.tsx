"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────────── */

interface ToastState {
  message: string;
  type: "saved" | "removed";
}

interface BookmarkContextValue {
  bookmarkedIsins: Set<string>;
  isBookmarked: (isin: string) => boolean;
  toggleBookmark: (isin: string, etfName: string) => Promise<boolean>;
  toast: ToastState | null;
  dismissToast: () => void;
}

/* ── Context ────────────────────────────────────────────────── */

const BookmarkContext = createContext<BookmarkContextValue | undefined>(
  undefined,
);

/* ── Provider ───────────────────────────────────────────────── */

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [rawBookmarks, setRawBookmarks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Stable supabase client reference (prevents effect re-runs on every render)
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Load bookmarks from DB when user changes
  useEffect(() => {
    // Don't clear bookmarks while auth is still loading —
    // that would cause a flash of empty state on page reload.
    if (authLoading) return;

    if (!userId) {
      setRawBookmarks(new Set());
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("user_saved_etfs")
        .select("isin")
        .eq("user_id", userId!);

      if (!cancelled && !error && data) {
        setRawBookmarks(new Set(data.map((r) => r.isin)));
      } else if (!cancelled && error) {
        console.error("Failed to load bookmarks:", error);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading]);

  // Derived: empty set when logged out, DB-backed set when logged in.
  const bookmarkedIsins = useMemo(
    () => (userId ? rawBookmarks : new Set<string>()),
    [userId, rawBookmarks],
  );

  const showToast = useCallback(
    (message: string, type: "saved" | "removed") => {
      setToast({ message, type });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    },
    [],
  );

  const toggleBookmark = useCallback(
    async (isin: string, etfName: string) => {
      if (!userId) return false;

      const currentlyBookmarked = bookmarkedIsins.has(isin);

      // ── Optimistic update ──────────────────────────────
      setRawBookmarks((prev) => {
        const next = new Set(prev);
        if (currentlyBookmarked) {
          next.delete(isin);
        } else {
          next.add(isin);
        }
        return next;
      });

      showToast(
        currentlyBookmarked
          ? `"${etfName}" removed from bookmarks`
          : `"${etfName}" saved to bookmarks`,
        currentlyBookmarked ? "removed" : "saved",
      );

      try {
        if (currentlyBookmarked) {
          await supabase
            .from("user_saved_etfs")
            .delete()
            .eq("user_id", userId)
            .eq("isin", isin);
        } else {
          await supabase.from("user_saved_etfs").insert({
            user_id: userId,
            isin: isin,
          });
        }
      } catch {
        // Rollback on error
        setRawBookmarks((prev) => {
          const next = new Set(prev);
          if (currentlyBookmarked) {
            next.add(isin);
          } else {
            next.delete(isin);
          }
          return next;
        });
      }

      return true;
    },
    [userId, supabase, bookmarkedIsins, showToast],
  );

  const isBookmarked = useCallback(
    (isin: string) => bookmarkedIsins.has(isin),
    [bookmarkedIsins],
  );

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarkedIsins,
        isBookmarked,
        toggleBookmark,
        toast,
        dismissToast,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useBookmarks() {
  const ctx = useContext(BookmarkContext);
  if (ctx === undefined) {
    throw new Error("useBookmarks must be used within a BookmarkProvider");
  }
  return ctx;
}
