"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Layers, ChevronRight } from "lucide-react";
import etfs from "../../public/data/etfs.json";
import type { ETF } from "../../types/etf";
import { BookmarkButton } from "@/components/bookmark-button";

/* ── Types ──────────────────────────────────────────────────── */

interface ETFSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Constants ──────────────────────────────────────────────── */

const DISTRIBUTION_LABELS: Record<string, string> = {
  acc: "Accumulating",
  dist: "Distributing",
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const allETFs = etfs as unknown as ETF[];

/* ── Inner search content (remounts via key when dialog opens) ─ */

function SearchContent({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedIsin, setExpandedIsin] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Filter ETFs by query
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return allETFs
      .filter(
        (etf) =>
          etf.name.toLowerCase().includes(q) ||
          etf.isin.toLowerCase().includes(q) ||
          etf.wkn.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [query]);

  // Clamp selectedIndex
  const safeIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));

  const handleIndexChange = useCallback((nextIndex: number) => {
    setSelectedIndex(nextIndex);
    if (listRef.current) {
      const el = listRef.current.children[nextIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const toggleExpand = useCallback((isin: string) => {
    setExpandedIsin((prev) => (prev === isin ? null : isin));
  }, []);

  const expandedETF = expandedIsin
    ? allETFs.find((e) => e.isin === expandedIsin) ?? null
    : null;

  /* ── Keyboard ─────────────────────────────────────────── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const len = results.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          handleIndexChange(safeIndex < len - 1 ? safeIndex + 1 : 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleIndexChange(safeIndex > 0 ? safeIndex - 1 : Math.max(len - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[safeIndex]) toggleExpand(results[safeIndex].isin);
          break;
        case "Escape":
          e.preventDefault();
          if (expandedIsin) {
            setExpandedIsin(null);
          } else {
            onClose();
          }
          break;
      }
    },
    [results, safeIndex, expandedIsin, onClose, toggleExpand, handleIndexChange]
  );

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="mx-4 rounded-xl border border-border bg-popover shadow-dialog overflow-hidden">
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-border px-4 h-12">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search ETFs by name, ISIN or WKN..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSelectedIndex(0);
            }}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Results list */}
      <div
        ref={listRef}
        className="max-h-90 overflow-y-auto overscroll-contain"
      >
        {query.trim() && results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="size-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No ETFs found for &quot;{query}&quot;
            </p>
          </div>
        ) : (
          results.map((etf, i) => (
            <button
              key={etf.isin + "-" + i}
              onClick={() => toggleExpand(etf.isin)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full text-left px-4 py-3 transition-colors border-b border-border/50 last:border-b-0 ${
                i === safeIndex ? "bg-muted/70" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {etf.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {etf.isin && etf.isin !== "N/A" ? etf.isin : etf.wkn ? `WKN ${etf.wkn}` : ""}
                    </span>
                    {etf.wkn && etf.isin && etf.isin !== "N/A" && (
                      <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                        WKN {etf.wkn}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                    TER {etf.ter}%
                  </span>
                  <BookmarkButton
                    isin={etf.isin}
                    name={etf.name}
                    className="size-7"
                  />
                  <ChevronRight
                    className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                      expandedIsin === etf.isin ? "rotate-90" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Expanded detail panel */}
              <AnimatePresence initial={false}>
                {expandedIsin === etf.isin && expandedETF && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      {/* Distribution & ESG */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <Layers className="size-3" />
                          {DISTRIBUTION_LABELS[expandedETF.distributionPolicy] ??
                            expandedETF.distributionPolicy}
                        </span>
                        {expandedETF.esgStatus !== "none" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                            ESG{" "}
                            {expandedETF.esgStatus === "article_8"
                              ? "Art. 8"
                              : "Art. 9"}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {expandedETF.totalHoldings?.toLocaleString() ?? "—"}{" "}
                          holdings
                        </span>
                      </div>

                      {/* Performance */}
                      {expandedETF.performance && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">
                              1Y Return
                            </p>
                            <p
                              className={`text-xs font-semibold tabular-nums ${
                                expandedETF.performance.return1Y >= 0
                                  ? "text-emerald-600"
                                  : "text-red-500"
                              }`}
                            >
                              {expandedETF.performance.return1Y > 0 ? "+" : ""}
                              {expandedETF.performance.return1Y}%
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">
                              3Y Return
                            </p>
                            <p
                              className={`text-xs font-semibold tabular-nums ${
                                expandedETF.performance.return3Y >= 0
                                  ? "text-emerald-600"
                                  : "text-red-500"
                              }`}
                            >
                              {expandedETF.performance.return3Y > 0 ? "+" : ""}
                              {expandedETF.performance.return3Y}%
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">
                              Volatility
                            </p>
                            <p className="text-xs font-semibold text-foreground tabular-nums">
                              {expandedETF.performance.volatility1Y}%
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Top sectors */}
                      {expandedETF.sectorAllocation && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                            Top Sectors
                          </p>
                          <div className="space-y-1">
                            {Object.entries(expandedETF.sectorAllocation)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 4)
                              .map(([sector, weight]) => (
                                <div
                                  key={sector}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-20 text-[11px] text-muted-foreground truncate">
                                    {sector}
                                  </span>
                                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{
                                        width: `${Math.min(weight, 100)}%`,
                                      }}
                                      transition={{
                                        duration: 0.5,
                                        ease: EASE_OUT,
                                      }}
                                      className="h-full rounded-full bg-primary/60"
                                    />
                                  </div>
                                  <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">
                                    {weight}%
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Top countries */}
                      {expandedETF.countryAllocation && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                            Top Countries
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(expandedETF.countryAllocation)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([country, weight]) => (
                                <span
                                  key={country}
                                  className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {country}{" "}
                                  <span className="ml-1 text-[10px] tabular-nums text-muted-foreground/60">
                                    {weight}%
                                  </span>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {expandedETF.summaryTags &&
                        expandedETF.summaryTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {expandedETF.summaryTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {results.length > 0 && (
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {results.length} ETF{results.length !== 1 ? "s" : ""} found
          </span>
          <span className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              details
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
                esc
              </kbd>{" "}
              close
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Outer wrapper (manages open/close + animation) ──────────── */

export function ETFSearch({ open, onOpenChange }: ETFSearchProps) {
  // Increment this key each time the dialog opens to force a clean remount
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => setRemountKey((k) => k + 1), 0);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key={`backdrop-${remountKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="fixed left-1/2 z-50 w-full max-w-lg -translate-x-1/2"
            style={{ top: "16vh" }}
          >
            <SearchContent
              key={remountKey}
              onClose={() => onOpenChange(false)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
