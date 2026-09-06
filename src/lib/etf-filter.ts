/**
 * Smart ETF Scoring Engine.
 *
 * Instead of hard-filtering (which kills valid candidates when no ETF
 * matches ALL criteria perfectly), every ETF gets a 0–100% match score.
 *
 * The LLM receives the top 15 candidates WITH their scores and can
 * intelligently reason about trade-offs (e.g. "Article 9 is stricter
 * than Article 8 — this ETF actually exceeds your ESG requirements").
 *
 * Used by both `/api/match` and `/api/chat`.
 */
import type { ETF } from "../../types/etf";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REGION_TAGS: Record<string, string[]> = {
  world: ["Developed Markets", "All-World", "Global", "Core"],
  us: ["S&P 500", "US Large Cap", "US"],
  europe: ["Europe"],
  emerging_markets: ["Emerging Markets"],
};

export type RiskPreference = "low_vol" | "balanced" | "max_div";
export type SectorTilt = "none" | "tech" | "dividend" | "healthcare";
export type DistributionPolicy = "acc" | "dist";
export type EsgStatus = "none" | "article_8" | "article_9";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoredETF {
  etf: ETF;
  score: number;        // 0–100 overall match
  breakdown: {
    region: number;     // 0–25
    distribution: number; // 0–15
    esg: number;        // 0–20
    risk: number;       // 0–20
    tilt: number;       // 0–20
  };
}

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

/**
 * Score how well an ETF matches a region preference.
 *  25 pts: exact region match (tags contain the region)
 *  15 pts: partial match (e.g. "US" tags for "World" — US is part of world)
 *   0 pts: no match
 */
function scoreRegion(etf: ETF, region: string): number {
  const tags = REGION_TAGS[region] ?? [];
  const match = etf.summaryTags.some((t: string) => tags.includes(t));
  if (match) return 25;

  // Partial: "World" user wants global, US ETFs are still relevant
  if (region === "world") {
    const usTags = etf.summaryTags.some((t: string) =>
      REGION_TAGS["us"].includes(t)
    );
    const euTags = etf.summaryTags.some((t: string) =>
      REGION_TAGS["europe"].includes(t)
    );
    if (usTags || euTags) return 15;
  }

  return 0;
}

/**
 * Score how well an ETF matches distribution preference.
 *  15 pts: exact match
 *   0 pts: no match
 */
export function scoreDistribution(etf: ETF, dist: DistributionPolicy): number {
  return etf.distributionPolicy === dist ? 15 : 0;
}

/**
 * Score how well an ETF matches ESG preference.
 *  20 pts: exact match
 *  18 pts: article_9 when user wants article_8 (stricter = upgrade)
 *  12 pts: article_8 when user wants article_9 (close but less strict)
 *  10 pts: any ESG when user wants "none" (bonus for having ESG)
 *   0 pts: no ESG when user wants ESG
 */
function scoreEsg(etf: ETF, esg: EsgStatus): number {
  if (esg === "none") {
    // User doesn't care about ESG — but having it is a bonus
    return etf.esgStatus === "none" ? 20 : 10;
  }
  if (etf.esgStatus === esg) return 20;

  // Smart upgrades: article_9 IS article_8 compliant (it's stricter)
  if (esg === "article_8" && etf.esgStatus === "article_9") return 18;

  // Close match: article_8 when user wants article_9
  if (esg === "article_9" && etf.esgStatus === "article_8") return 12;

  return 0;
}

/**
 * Score how well an ETF matches risk preference.
 *  20 pts: best in class for the user's risk preference
 *  Uses percentile-based scoring within the candidate set.
 */
function scoreRisk(
  etf: ETF,
  risk: RiskPreference,
  allEtfs: ETF[],
): number {
  const vol = etf.performance.volatility1Y;
  const ret = etf.performance.return1Y;

  // Find min/max in the full set for normalization
  const minVol = Math.min(...allEtfs.map((e) => e.performance.volatility1Y));
  const maxVol = Math.max(...allEtfs.map((e) => e.performance.volatility1Y));
  const maxRet = Math.max(...allEtfs.map((e) => e.performance.return1Y));
  const minRet = Math.min(...allEtfs.map((e) => e.performance.return1Y));

  const volRange = maxVol - minVol || 1;
  const retRange = maxRet - minRet || 1;

  switch (risk) {
    case "low_vol": {
      // Lower volatility = higher score
      const volScore = 1 - (vol - minVol) / volRange; // 0–1 (1 = lowest vol)
      return Math.round(volScore * 20);
    }
    case "max_div": {
      // More holdings = higher score
      const maxHoldings = Math.max(...allEtfs.map((e) => e.totalHoldings));
      const minHoldings = Math.min(...allEtfs.map((e) => e.totalHoldings));
      const hRange = maxHoldings - minHoldings || 1;
      const hScore = (etf.totalHoldings - minHoldings) / hRange;
      return Math.round(hScore * 20);
    }
    case "balanced": {
      // Risk-adjusted return (Sharpe-like)
      const raScore = (ret - minRet) / retRange - 0.5 * (vol - minVol) / volRange;
      // Normalize to 0–20
      const normalized = Math.max(0, Math.min(1, raScore + 0.5));
      return Math.round(normalized * 20);
    }
  }
}

/**
 * Score how well an ETF matches sector tilt.
 *  20 pts: high sector concentration matching the tilt
 */
function scoreTilt(etf: ETF, tilt: SectorTilt): number {
  if (tilt === "none") return 20; // No preference = full score
  const sectors = etf.sectorAllocation;
  let raw: number;
  switch (tilt) {
    case "tech":
      raw = sectors["Technology"] ?? 0;
      break;
    case "dividend":
      raw =
        (sectors["Financials"] ?? 0) +
        (sectors["Consumer Staples"] ?? 0) +
        (sectors["Utilities"] ?? 0);
      break;
    case "healthcare":
      raw = sectors["Healthcare"] ?? 0;
      break;
  }
  // Normalize: 0% of sector = 0 pts, 50%+ = 20 pts
  return Math.round(Math.min(raw / 50, 1) * 20);
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score all ETFs against the user's preferences.
 * Returns top 15 candidates sorted by overall match score.
 */
export function scoreCandidates(
  allEtfs: ETF[],
  region: string,
  distributionPolicy: DistributionPolicy,
  esgStatus: EsgStatus,
  riskPreference: RiskPreference,
  sectorTilt: SectorTilt,
): ScoredETF[] {
  const scored = allEtfs.map((etf) => {
    const regionScore = scoreRegion(etf, region);
    const distScore = scoreDistribution(etf, distributionPolicy);
    const esgScore = scoreEsg(etf, esgStatus);
    const riskScore = scoreRisk(etf, riskPreference, allEtfs);
    const tiltScore = scoreTilt(etf, sectorTilt);

    const total = regionScore + distScore + esgScore + riskScore + tiltScore;

    return {
      etf,
      score: total,
      breakdown: {
        region: regionScore,
        distribution: distScore,
        esg: esgScore,
        risk: riskScore,
        tilt: tiltScore,
      },
    };
  });

  // Sort by score descending, take top 15
  return scored.sort((a, b) => b.score - a.score).slice(0, 15);
}

// ---------------------------------------------------------------------------
// Legacy: filterCandidates (kept for /api/match backward compatibility)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use scoreCandidates() for new code.
 * Kept for backward compatibility with /api/match route.
 */
export function filterCandidates(
  allEtfs: ETF[],
  region: string,
  distributionPolicy: DistributionPolicy,
  esgStatus: EsgStatus,
  riskPreference: RiskPreference,
  sectorTilt: SectorTilt,
): ETF[] {
  const scored = scoreCandidates(
    allEtfs,
    region,
    distributionPolicy,
    esgStatus,
    riskPreference,
    sectorTilt,
  );
  // Only return ETFs that score >= 60 (reasonable match)
  return scored.filter((s) => s.score >= 60).map((s) => s.etf).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Scoring (tilt / risk helpers — kept for backward compat)
// ---------------------------------------------------------------------------

export function tiltScore(etf: ETF, tilt: SectorTilt): number {
  if (tilt === "none") return 0;
  const sectors = etf.sectorAllocation;
  switch (tilt) {
    case "tech":
      return sectors["Technology"] ?? 0;
    case "dividend":
      return (
        (sectors["Financials"] ?? 0) +
        (sectors["Consumer Staples"] ?? 0) +
        (sectors["Utilities"] ?? 0)
      );
    case "healthcare":
      return sectors["Healthcare"] ?? 0;
  }
}

export function applyTilt(etfs: ETF[], tilt: SectorTilt): ETF[] {
  if (tilt === "none") return etfs;
  return [...etfs].sort((a, b) => tiltScore(b, tilt) - tiltScore(a, tilt));
}

export function rankByRisk(etfs: ETF[], risk: RiskPreference): ETF[] {
  const copy = [...etfs];
  switch (risk) {
    case "low_vol":
      copy.sort((a, b) => {
        const v = a.performance.volatility1Y - b.performance.volatility1Y;
        if (v !== 0) return v;
        return b.performance.return1Y - a.performance.return1Y;
      });
      break;
    case "balanced":
      copy.sort((a, b) => {
        const scoreA = a.performance.return1Y - 0.5 * a.performance.volatility1Y;
        const scoreB = b.performance.return1Y - 0.5 * b.performance.volatility1Y;
        return scoreB - scoreA;
      });
      break;
    case "max_div":
      copy.sort((a, b) => b.totalHoldings - a.totalHoldings);
      break;
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Summarisation for LLM prompts
// ---------------------------------------------------------------------------

/**
 * Build a concise text summary of an ETF for the LLM prompt.
 * Only includes fields the LLM actually needs for recommendations.
 */
export function describeEtf(etf: ETF): string {
  return [
    `ISIN: ${etf.isin}`,
    `WKN: ${etf.wkn}`,
    `Name: ${etf.name}`,
    `TER: ${etf.ter}%`,
    `Distribution: ${etf.distributionPolicy === "acc" ? "Accumulating" : "Distributing"}`,
    `ESG: ${etf.esgStatus === "none" ? "None" : etf.esgStatus === "article_8" ? "Article 8 (light green)" : "Article 9 (dark green)"}`,
    `Holdings: ${etf.totalHoldings}`,
    `Tags: ${etf.summaryTags.join(", ")}`,
    `1Y Return: ${etf.performance.return1Y}%`,
    `3Y Return: ${etf.performance.return3Y}%`,
    `Volatility (1Y): ${etf.performance.volatility1Y}%`,
  ].join(" | ");
}

/**
 * Build a scored ETF description for the LLM prompt.
 * Includes the score breakdown so the LLM can reason about trade-offs.
 */
export function describeScoredEtf(s: ScoredETF): string {
  const e = s.etf;
  const topHoldings = (e.top10Holdings ?? [])
    .slice(0, 5)
    .map((h) => `${h.name}: ${h.weight}%`)
    .join(", ");

  const sectors = Object.entries(e.sectorAllocation ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}%`)
    .join(", ");

  const countries = Object.entries(e.countryAllocation ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}%`)
    .join(", ");

  const lines = [
    `ISIN: ${e.isin}`,
    `WKN: ${e.wkn}`,
    `Name: ${e.name}`,
    `TER: ${e.ter}% p.a.`,
    `Ausschüttung: ${e.distributionPolicy === "acc" ? "Thesaurierend" : "Ausschüttend"}`,
    `ESG: ${e.esgStatus === "none" ? "Keine" : e.esgStatus === "article_8" ? "Artikel 8 (hellgrün)" : "Artikel 9 (dunkelgrün)"}`,
    `Anzahl Positionen: ${e.totalHoldings}`,
    `1-Jahres-Rendite: ${e.performance.return1Y}%`,
    `3-Jahres-Rendite: ${e.performance.return3Y}%`,
    `1-Jahres-Volatilität: ${e.performance.volatility1Y}%`,
    `MATCH-SCORE: ${s.score}/100 (Region: ${s.breakdown.region}/25, Ausschüttung: ${s.breakdown.distribution}/15, ESG: ${s.breakdown.esg}/20, Risiko: ${s.breakdown.risk}/20, Sektor: ${s.breakdown.tilt}/20)`,
    `Top 5 Sektoren: ${sectors || "Nicht verfügbar"}`,
  ];

  if (countries) lines.push(`Top 5 Länder: ${countries}`);
  if (topHoldings) lines.push(`Top 5 Holdings: ${topHoldings}`);
  lines.push(`Tags: ${e.summaryTags.join(", ")}`);

  return lines.join("\n");
}
