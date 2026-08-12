"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Layers, Activity } from "lucide-react";
import { useState } from "react";
import { BookmarkButton } from "@/components/bookmark-button";
import type { ETF } from "../../types/etf";
import type { MarketDataQuote } from "@/lib/twelvedata";

interface ETFChatCardProps {
  etf: ETF;
  /** Live market data from Twelve Data (optional — card gracefully degrades) */
  marketData?: MarketDataQuote | null;
  /** Whether market data is still loading */
  marketDataLoading?: boolean;
}

const DISTRIBUTION_LABELS: Record<string, string> = {
  acc: "Accumulating",
  dist: "Distributing",
};

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)} M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)} K`;
  return vol.toLocaleString("de-DE");
}

function formatChange(change: number, percent: number): { text: string; isPositive: boolean; isZero: boolean } {
  const isPositive = change > 0;
  const isZero = change === 0;
  const sign = isPositive ? "+" : "";
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`,
    isPositive,
    isZero,
  };
}

export function ETFChatCard({ etf, marketData, marketDataLoading }: ETFChatCardProps) {
  const [expanded, setExpanded] = useState(false);

  const changeInfo = marketData
    ? formatChange(marketData.change, marketData.change_percent)
    : null;

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-background/60 overflow-hidden">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{etf.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {etf.isin && etf.isin !== "N/A" ? etf.isin : etf.wkn ? `WKN ${etf.wkn}` : ""}
            </span>
            {etf.wkn && etf.isin && etf.isin !== "N/A" && (
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                WKN {etf.wkn}
              </span>
            )}
            {marketData && (
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                {marketData.exchange}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {marketData && (
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {formatPrice(marketData.price, marketData.currency)}
              </span>
              <span
                className={`text-[10px] font-medium tabular-nums ${
                  changeInfo?.isZero
                    ? "text-muted-foreground"
                    : changeInfo?.isPositive
                      ? "text-emerald-600"
                      : "text-red-500"
                }`}
              >
                {changeInfo?.text}
              </span>
            </div>
          )}
          {marketDataLoading && !marketData && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-10 animate-pulse rounded bg-muted" />
            </div>
          )}
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
            TER {etf.ter}%
          </span>
          <BookmarkButton isin={etf.isin} name={etf.name} className="size-6" />
          <ChevronRight
            className={`size-3 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5">
              {/* ── Live Market Data ── */}
              {marketData && (
                <div className="rounded-lg bg-linear-to-br from-primary/5 to-transparent border border-primary/10 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="size-3 text-primary" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                      Live Kurs • {marketData.exchange || "Marktdaten"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Eröffnung</p>
                      <p className="text-[11px] font-semibold tabular-nums">
                        {formatPrice(marketData.open, marketData.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Tagestief</p>
                      <p className="text-[11px] font-semibold tabular-nums">
                        {formatPrice(marketData.low, marketData.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Tageshoch</p>
                      <p className="text-[11px] font-semibold tabular-nums">
                        {formatPrice(marketData.high, marketData.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-muted-foreground">52W Hoch</p>
                      <p className="text-[11px] font-semibold tabular-nums text-emerald-600">
                        {marketData.fifty_two_week.high > 0
                          ? formatPrice(marketData.fifty_two_week.high, marketData.currency)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">52W Tief</p>
                      <p className="text-[11px] font-semibold tabular-nums text-red-500">
                        {marketData.fifty_two_week.low > 0
                          ? formatPrice(marketData.fifty_two_week.low, marketData.currency)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Volumen</p>
                      <p className="text-[11px] font-semibold tabular-nums">
                        {formatVolume(marketData.volume)}
                      </p>
                    </div>
                  </div>

                  {/* Price position bar: where current price sits in day range */}
                  {marketData.high > marketData.low && marketData.price > 0 && (
                    <div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                        <span>{formatPrice(marketData.low, marketData.currency)}</span>
                        <span>{formatPrice(marketData.high, marketData.currency)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                ((marketData.price - marketData.low) /
                                  (marketData.high - marketData.low)) *
                                  100,
                              ),
                            )}%`,
                          }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full rounded-full ${
                            changeInfo?.isPositive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {marketData.updated_at && (
                    <p className="text-[9px] text-muted-foreground/60 text-right">
                      Stand: {new Date(marketData.updated_at).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Distribution & ESG */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Layers className="size-2.5" />
                  {DISTRIBUTION_LABELS[etf.distributionPolicy] ?? etf.distributionPolicy}
                </span>
                {etf.esgStatus !== "none" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                    ESG {etf.esgStatus === "article_8" ? "Art. 8" : "Art. 9"}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {etf.totalHoldings?.toLocaleString() ?? "—"} holdings
                </span>
              </div>

              {/* Performance */}
              {etf.performance && (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-md bg-muted/50 p-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">1Y Return</p>
                    <p
                      className={`text-[11px] font-semibold tabular-nums ${
                        etf.performance.return1Y >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {etf.performance.return1Y > 0 ? "+" : ""}
                      {etf.performance.return1Y}%
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">3Y Return</p>
                    <p
                      className={`text-[11px] font-semibold tabular-nums ${
                        etf.performance.return3Y >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {etf.performance.return3Y > 0 ? "+" : ""}
                      {etf.performance.return3Y}%
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">Volatility</p>
                    <p className="text-[11px] font-semibold text-foreground tabular-nums">
                      {etf.performance.volatility1Y}%
                    </p>
                  </div>
                </div>
              )}

              {/* Top sectors */}
              {etf.sectorAllocation && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Top Sectors</p>
                  <div className="space-y-0.5">
                    {Object.entries(etf.sectorAllocation)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 4)
                      .map(([sector, weight]) => (
                        <div key={sector} className="flex items-center gap-1.5">
                          <span className="w-16 text-[10px] text-muted-foreground truncate">
                            {sector}
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(weight, 100)}%` }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full bg-primary/60"
                            />
                          </div>
                          <span className="w-8 text-right text-[10px] text-muted-foreground tabular-nums">
                            {weight}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {etf.summaryTags && etf.summaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {etf.summaryTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
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
    </div>
  );
}
