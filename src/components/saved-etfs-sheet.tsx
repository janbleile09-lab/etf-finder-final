"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bookmark, ExternalLink } from "lucide-react";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { BookmarkButton } from "@/components/bookmark-button";
import etfs from "../../public/data/etfs.json";
import type { ETF } from "../../types/etf";
import { useMemo } from "react";

interface SavedEtfsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedEtfsSheet({ open, onOpenChange }: SavedEtfsSheetProps) {
  const { bookmarkedIsins } = useBookmarks();

  const savedEtfs = useMemo(() => {
    const allEtfs = etfs as unknown as ETF[];
    return Array.from(bookmarkedIsins)
      .map((isin) => allEtfs.find((e) => e.isin === isin))
      .filter((e): e is ETF => e !== undefined);
  }, [bookmarkedIsins]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 bg-black/20 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Slide-over sheet */}
          <motion.div
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-110 flex w-full max-w-sm flex-col bg-background shadow-2xl border-l border-border sm:max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Bookmark className="size-5 text-primary" />
                <h2 className="text-lg font-semibold tracking-tight">Saved ETFs</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {savedEtfs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <Bookmark className="size-8 opacity-20" />
                  <p className="text-sm font-medium text-foreground">No saved ETFs</p>
                  <p className="text-xs">Your bookmarked ETFs will appear here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {savedEtfs.map((etf) => (
                    <div
                      key={etf.isin}
                      className="group relative flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-border hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0">
                          <h3 className="text-sm font-semibold leading-tight text-foreground truncate">
                            {etf.name}
                          </h3>
                          <span className="text-xs text-muted-foreground font-mono mt-0.5">
                            {etf.isin}
                          </span>
                        </div>
                        <BookmarkButton
                          isin={etf.isin}
                          name={etf.name}
                          className="shrink-0"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          TER {etf.ter}%
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                          {etf.distributionPolicy === "acc" ? "Acc" : "Dist"}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                          {etf.totalHoldings} holdings
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
