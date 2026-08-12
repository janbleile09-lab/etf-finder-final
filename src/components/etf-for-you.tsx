"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  X,
  TrendingUp,
  PieChart,
  Building2,
  Layers,
  Zap,
  Leaf,
  Shield,
  Coins,
  Cpu,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BookmarkButton } from "@/components/bookmark-button";
import { Sparkline, type SparklineData } from "@/components/sparkline";
import etfsJson from "../../public/data/etfs.json";
import type { ETF } from "../../types/etf";

/** Shape of the /api/homepage-market-data response */
interface HomepageQuote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  currency: string;
}

/* ── Constants ───────────────────────────────────────────────── */

const allETFs = etfsJson as unknown as ETF[];

const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const;

const DISTRIBUTION_LABELS: Record<string, string> = {
  acc: "Accumulating",
  dist: "Distributing",
};

const SECTOR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-lime-500",
];

function getSectorColor(index: number): string {
  return SECTOR_COLORS[index % SECTOR_COLORS.length] ?? "bg-slate-400";
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/* ── Recommendation definition ──────────────────────────────── */

interface Recommendation {
  isin: string;
  label: string;
  description: string;
  rationale: string;
  icon: React.ReactNode;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    isin: "IE00B4L5Y983",
    label: "Bester Allrounder",
    description: "Breit gestreut in 1.281 Aktien weltweit",
    rationale:
      "Der MSCI World ist der Goldstandard für globale Diversifikation. Mit über 1.280 Unternehmen aus 23 Industrieländern und einer TER von nur 0,20 % bietet dieser ETF eine hervorragende Basis für jedes Portfolio.",
    icon: <Zap className="size-4" />,
  },
  {
    isin: "IE00B5BMR087",
    label: "Günstigster Einstieg",
    description: "Nur 0,07 % TER auf den S&P 500",
    rationale:
      "Mit einer TER von lediglich 0,07 % ist dieser ETF der kostengünstigste Weg, in die 500 größten US-Unternehmen zu investieren. Ideal für langfristigen Vermögensaufbau mit minimalen Gebühren.",
    icon: <Coins className="size-4" />,
  },
  {
    isin: "IE00BDZZTM54",
    label: "Nachhaltig investieren",
    description: "MSCI World SRI – sozial verantwortlich",
    rationale:
      "Dieser ETF filtert nach strengen ESG-Kriterien und schließt kontroverse Branchen aus. Er kombiniert globale Diversifikation mit sozialer Verantwortung — ohne nennenswerte Renditeeinbußen.",
    icon: <Leaf className="size-4" />,
  },
  {
    isin: "IE00B53SZB19",
    label: "Tech-Wachstum",
    description: "NASDAQ 100 mit Fokus auf Tech-Giganten",
    rationale:
      "Der NASDAQ 100 enthält die 100 größten nicht-finanziellen Unternehmen der NASDAQ. Schwerpunkt auf Apple, Microsoft, NVIDIA & Co. — ideal für Anleger mit Wachstumsfokus und höherer Risikobereitschaft.",
    icon: <Cpu className="size-4" />,
  },
  {
    isin: "IE00B4ND3602",
    label: "Sicherer Hafen",
    description: "Physisches Gold als Inflationsschutz",
    rationale:
      "Gold hat sich über Jahrhunderte als Wertaufbewahrungsmittel bewährt. Dieser ETC ist zu 100 % physisch mit Gold hinterlegt — eine sinnvolle Beimischung von 5–10 % zur Portfolio-Stabilisierung.",
    icon: <Shield className="size-4" />,
  },
  {
    isin: "DE000A0F5UH1",
    label: "Passives Einkommen",
    description: "Hohe Dividendenrendite weltweit",
    rationale:
      "Dieser ETF investiert gezielt in Unternehmen mit überdurchschnittlicher Dividendenrendite. Perfekt für Anleger, die regelmäßige Ausschüttungen schätzen und ein passives Einkommen aufbauen möchten.",
    icon: <Coins className="size-4" />,
  },
];

/* ── Animated Progress Bar ──────────────────────────────────── */

const progressBarVariants: Variants = {
  hidden: { width: "0%" },
  visible: (width: number) => ({
    width: `${Math.min(width, 100)}%`,
    transition: {
      duration: 0.7,
      ease: EASE_OUT_STRONG,
      delay: 0.15,
    },
  }),
};

function AnimatedProgressBar({
  label,
  value,
  index,
  animate,
}: {
  label: string;
  value: number;
  index: number;
  animate: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatPercent(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", getSectorColor(index))}
          variants={shouldReduceMotion ? undefined : progressBarVariants}
          initial="hidden"
          animate={animate ? "visible" : "hidden"}
          custom={value}
        />
      </div>
    </div>
  );
}

/* ── Breakdown Sheet ────────────────────────────────────────── */

interface BreakdownSheetProps {
  etf: ETF;
  open: boolean;
  onClose: () => void;
}

function BreakdownSheet({ etf, open, onClose }: BreakdownSheetProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="fy-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.15 }
                : { duration: 0.2, ease: EASE_OUT_STRONG }
            }
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="fy-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={
              shouldReduceMotion
                ? { duration: 0.2 }
                : {
                    type: "spring",
                    stiffness: 350,
                    damping: 32,
                    mass: 0.9,
                  }
            }
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/60 bg-card shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {etf.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {etf.totalHoldings.toLocaleString()} holdings
                </p>
              </div>
              <button
                onClick={onClose}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                aria-label="Schließen"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 overscroll-contain">
              {/* Top 10 Holdings */}
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Top 10 Holdings
                  </h4>
                </div>
                <ul className="space-y-0.5">
                  {etf.top10Holdings.map(
                    (holding: { name: string; weight: number }, i: number) => (
                      <li
                        key={holding.name}
                        className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="text-sm text-foreground">
                            {holding.name}
                          </span>
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatPercent(holding.weight)}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </section>

              {/* Divider */}
              <div className="mb-6 h-px bg-border/50" />

              {/* Sector Allocation */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <PieChart className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Sektor-Allokation
                  </h4>
                </div>
                <div className="space-y-3">
                  {Object.entries(etf.sectorAllocation)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sector, value], i) => (
                      <AnimatedProgressBar
                        key={sector}
                        label={sector}
                        value={value}
                        index={i}
                        animate={open}
                      />
                    ))}
                </div>
              </section>

              {/* Performance quick stats */}
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Performance
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "1Y Return",
                      value: `${etf.performance.return1Y}%`,
                      positive: etf.performance.return1Y > 0,
                    },
                    {
                      label: "3Y Return",
                      value: `${etf.performance.return3Y}%`,
                      positive: etf.performance.return3Y > 0,
                    },
                    {
                      label: "Volatilität",
                      value: `${etf.performance.volatility1Y}%`,
                      positive: false,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
                    >
                      <span className="text-[11px] text-muted-foreground">
                        {stat.label}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          stat.positive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        )}
                      >
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Card Component ─────────────────────────────────────────── */

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 320,
      damping: 26,
      mass: 0.8,
    },
  },
};

interface ForYouCardProps {
  rec: Recommendation;
  etf: ETF | undefined;
  index: number;
  onViewBreakdown: () => void;
  isBookmarked: boolean;
  quote: HomepageQuote | undefined;
  timeSeries: SparklineData | undefined;
  marketLoading: boolean;
}

function ForYouCard({
  rec,
  etf,
  index,
  onViewBreakdown,
  isBookmarked,
  quote,
  timeSeries,
  marketLoading,
}: ForYouCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const priceChangePositive = quote ? quote.change_percent >= 0 : true;

  return (
    <motion.div
      layout
      variants={shouldReduceMotion ? undefined : cardVariants}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border/60 bg-card p-5",
        "shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] ring-1 ring-foreground/5",
        "group"
      )}
    >
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary/60 via-primary/30 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {rec.icon}
              {rec.label}
            </span>
          </div>
          <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground mt-1">
            {etf?.name ?? rec.description}
          </h3>
          <p className="text-[13px] text-muted-foreground">
            {rec.description}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <BookmarkButton
            isin={rec.isin}
            name={etf?.name ?? rec.label}
            initialBookmarked={isBookmarked}
          />
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
            {index + 1}
          </span>
        </div>
      </div>

      {/* Badges */}
      {etf && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
            {etf.wkn}
          </span>
          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {etf.isin}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/6 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            TER {etf.ter}%
          </span>
          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/60">
            {DISTRIBUTION_LABELS[etf.distributionPolicy] ??
              etf.distributionPolicy}
          </span>
          {etf.esgStatus !== "none" && (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                etf.esgStatus === "article_9"
                  ? "border-green-500/20 bg-green-500/6 text-green-700 dark:text-green-400"
                  : "border-blue-500/20 bg-blue-500/6 text-blue-700 dark:text-blue-400"
              )}
            >
              {etf.esgStatus === "article_9" ? "Article 9" : "Article 8"}
            </span>
          )}
        </div>
      )}

      {/* Rationale */}
      <div className="flex items-start gap-2.5 rounded-lg bg-blue-500/5 px-3.5 py-3 dark:bg-blue-500/10">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
        <p className="text-[13px] leading-relaxed text-foreground/75">
          {rec.rationale}
        </p>
      </div>

      {/* Live Market Data (from TwelveData, refreshed every 10 min) */}
      <div className="flex items-center justify-center gap-4 rounded-lg bg-muted/30 px-4 py-3">
        {/* Sparkline */}
        <div className="shrink-0">
          <Sparkline
            data={timeSeries ?? null}
            width={80}
            height={36}
            loading={marketLoading}
          />
        </div>
        {/* Price & Change */}
        <div className="flex flex-col items-end min-w-0">
          {quote ? (
            <>
              <span className="text-base font-semibold tabular-nums text-foreground leading-tight">
                {quote.currency === "EUR" ? "€" : quote.currency === "USD" ? "$" : ""}
                {quote.price.toFixed(2)}
              </span>
              <span
                className={`text-[12px] font-medium tabular-nums ${
                  priceChangePositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                }`}
              >
                {priceChangePositive ? "+" : ""}
                {quote.change.toFixed(2)} ({priceChangePositive ? "+" : ""}
                {quote.change_percent.toFixed(2)}%)
              </span>
            </>
          ) : marketLoading ? (
            <>
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-14 animate-pulse rounded bg-muted" />
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground">
              Keine Live-Daten verfügbar
            </span>
          )}
        </div>
      </div>

      {/* Performance mini cards */}
      {etf && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">1Y Return</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                etf.performance.return1Y >= 0
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {etf.performance.return1Y > 0 ? "+" : ""}
              {etf.performance.return1Y}%
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">3Y Return</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                etf.performance.return3Y >= 0
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {etf.performance.return3Y > 0 ? "+" : ""}
              {etf.performance.return3Y}%
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Volatilität</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {etf.performance.volatility1Y}%
            </p>
          </div>
        </div>
      )}

      {/* View Breakdown button */}
      {etf && (
        <motion.button
          type="button"
          onClick={onViewBreakdown}
          whileHover={
            shouldReduceMotion
              ? undefined
              : { scale: 1.01, transition: { duration: 0.15 } }
          }
          whileTap={
            shouldReduceMotion
              ? undefined
              : { scale: 0.97, transition: { duration: 0.1 } }
          }
          className={cn(
            "inline-flex items-center gap-1.5 self-start rounded-lg border border-border/60",
            "bg-muted/30 px-3 py-1.5 text-[13px] font-medium text-foreground/70",
            "transition-colors hover:bg-muted hover:text-foreground",
            "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          )}
        >
          <Layers className="size-3.5" />
          Details anzeigen
          <ChevronRight className="size-3.5 -mr-0.5" />
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Container ──────────────────────────────────────────────── */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
      when: "beforeChildren",
    },
  },
};

export function ETFForYou() {
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // ── Live market data state ──
  const [quotes, setQuotes] = useState<Map<string, HomepageQuote>>(new Map());
  const [timeSeriesMap, setTimeSeriesMap] = useState<Map<string, SparklineData>>(new Map());
  const [marketLoading, setMarketLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchMarketData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setMarketLoading(true);
      const res = await fetch("/api/homepage-market-data");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const q = new Map<string, HomepageQuote>();
      if (data.quotes) {
        for (const [isin, quote] of Object.entries(data.quotes)) {
          q.set(isin, quote as HomepageQuote);
        }
      }
      setQuotes(q);

      const ts = new Map<string, SparklineData>();
      if (data.timeSeries) {
        for (const [isin, series] of Object.entries(data.timeSeries)) {
          ts.set(isin, series as SparklineData);
        }
      }
      setTimeSeriesMap(ts);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("ETFForYou market data fetch error:", err);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount (show loading skeleton)
    fetchMarketData(true);

    // Then every 10 minutes (silent refresh, no loading skeleton)
    intervalRef.current = setInterval(() => fetchMarketData(), 10 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMarketData]);

  const resolvedRecs = useMemo(() => {
    return RECOMMENDATIONS.map((rec) => ({
      rec,
      etf: allETFs.find((e) => e.isin === rec.isin),
    }));
  }, []);

  const selectedEtf = useMemo(() => {
    if (!selectedIsin) return undefined;
    return allETFs.find((e) => e.isin === selectedIsin);
  }, [selectedIsin]);

  const handleViewBreakdown = useCallback((isin: string) => {
    setSelectedIsin(isin);
  }, []);

  const handleCloseBreakdown = useCallback(() => {
    setSelectedIsin(null);
  }, []);

  return (
    <motion.section
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.15 }
          : { duration: 0.4, ease: EASE_OUT_STRONG }
      }
      className="w-full max-w-lg space-y-5"
    >
      {/* Section heading */}
      <div className="flex flex-col gap-1 text-center">
        <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="size-3" />
          For You
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Top-Empfehlungen für dein Portfolio
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Kuratierte ETFs für jeden Anlagetyp — mit nur einem Klick speichern.
        </p>
      </div>

      {/* Cards */}
      <motion.div
        variants={shouldReduceMotion ? undefined : containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3"
      >
        <AnimatePresence mode="popLayout">
          {resolvedRecs.map(({ rec, etf }, i) => (
            <ForYouCard
              key={rec.isin}
              rec={rec}
              etf={etf}
              index={i}
              onViewBreakdown={() => handleViewBreakdown(rec.isin)}
              isBookmarked={false}
              quote={quotes.get(rec.isin)}
              timeSeries={timeSeriesMap.get(rec.isin)}
              marketLoading={marketLoading}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Last updated indicator */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        {lastUpdated ? (
          <span>
            Live-Daten aktualisiert um{" "}
            {lastUpdated.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" "}· Nächstes Update in 10 Min.
          </span>
        ) : (
          <span>Live-Daten werden geladen...</span>
        )}
      </div>

      {/* Breakdown Sheet */}
      {selectedEtf && (
        <BreakdownSheet
          etf={selectedEtf}
          open={!!selectedEtf}
          onClose={handleCloseBreakdown}
        />
      )}
    </motion.section>
  );
}
