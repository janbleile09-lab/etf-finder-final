import { describe, it, expect } from "vitest";
import { scoreDistribution, describeEtf } from "./etf-filter";
import { ETF } from "../../types/etf";

describe("scoreDistribution", () => {
  it("returns 15 when the ETF policy matches the desired accumulating policy", () => {
    const etf = { distributionPolicy: "acc" } as ETF;
    const score = scoreDistribution(etf, "acc");
    expect(score).toBe(15);
  });

  it("returns 15 when the ETF policy matches the desired distributing policy", () => {
    const etf = { distributionPolicy: "dist" } as ETF;
    const score = scoreDistribution(etf, "dist");
    expect(score).toBe(15);
  });

  it("returns 0 when the ETF policy is acc but dist is desired", () => {
    const etf = { distributionPolicy: "acc" } as ETF;
    const score = scoreDistribution(etf, "dist");
    expect(score).toBe(0);
  });

  it("returns 0 when the ETF policy is dist but acc is desired", () => {
    const etf = { distributionPolicy: "dist" } as ETF;
    const score = scoreDistribution(etf, "acc");
    expect(score).toBe(0);
  });
});

describe("describeEtf", () => {
  const baseMockEtf: ETF = {
    isin: "IE00B4L5Y983",
    wkn: "A0RPWH",
    name: "iShares Core MSCI World UCITS ETF USD (Acc)",
    ter: 0.2,
    distributionPolicy: "acc",
    esgStatus: "none",
    totalHoldings: 1500,
    summaryTags: ["World", "Developed Markets"],
    performance: {
      return1Y: 10.5,
      return3Y: 35.2,
      volatility1Y: 12.1,
    },
    sectorAllocation: {},
    countryAllocation: {},
    top10Holdings: [],
  };

  it("formats an accumulating ETF with no ESG correctly", () => {
    const result = describeEtf(baseMockEtf);
    expect(result).toBe(
      "ISIN: IE00B4L5Y983 | WKN: A0RPWH | Name: iShares Core MSCI World UCITS ETF USD (Acc) | TER: 0.2% | Distribution: Accumulating | ESG: None | Holdings: 1500 | Tags: World, Developed Markets | 1Y Return: 10.5% | 3Y Return: 35.2% | Volatility (1Y): 12.1%",
    );
  });

  it("formats a distributing ETF correctly", () => {
    const etf: ETF = { ...baseMockEtf, distributionPolicy: "dist" };
    const result = describeEtf(etf);
    expect(result).toContain("Distribution: Distributing");
  });

  it("formats an Article 8 ESG ETF correctly", () => {
    const etf: ETF = { ...baseMockEtf, esgStatus: "article_8" };
    const result = describeEtf(etf);
    expect(result).toContain("ESG: Article 8 (light green)");
  });

  it("formats an Article 9 ESG ETF correctly", () => {
    const etf: ETF = { ...baseMockEtf, esgStatus: "article_9" };
    const result = describeEtf(etf);
    expect(result).toContain("ESG: Article 9 (dark green)");
  });
});
