import { describe, it, expect } from "vitest";
import { scoreDistribution, applyTilt } from "./etf-filter";
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

describe("applyTilt", () => {
  const etfTech = {
    name: "Tech ETF",
    sectorAllocation: { Technology: 80, Healthcare: 10 },
  } as unknown as ETF;
  const etfHealth = {
    name: "Health ETF",
    sectorAllocation: { Healthcare: 90, Technology: 5 },
  } as unknown as ETF;
  const etfDiv = {
    name: "Dividend ETF",
    sectorAllocation: { Financials: 40, "Consumer Staples": 30, Utilities: 20 },
  } as unknown as ETF;
  const etfEmpty = {
    name: "Empty ETF",
    sectorAllocation: {},
  } as unknown as ETF;

  const etfs = [etfTech, etfHealth, etfDiv, etfEmpty];

  it("returns the same array when the tilt is none", () => {
    const result = applyTilt(etfs, "none");
    expect(result).toEqual(etfs);
  });

  it("sorts correctly for tech tilt", () => {
    const result = applyTilt(etfs, "tech");
    expect(result[0].name).toBe("Tech ETF");
    expect(result[1].name).toBe("Health ETF");
    expect(result[2].name).toBe("Dividend ETF");
  });

  it("sorts correctly for healthcare tilt", () => {
    const result = applyTilt(etfs, "healthcare");
    expect(result[0].name).toBe("Health ETF");
    expect(result[1].name).toBe("Tech ETF");
  });

  it("sorts correctly for dividend tilt", () => {
    const result = applyTilt(etfs, "dividend");
    expect(result[0].name).toBe("Dividend ETF");
  });

  it("handles ETFs gracefully when they are missing the required sector allocation", () => {
    const result = applyTilt([etfEmpty], "tech");
    expect(result).toEqual([etfEmpty]);
  });

  it("properly handles an empty array", () => {
    const result = applyTilt([], "tech");
    expect(result).toEqual([]);
  });
});
