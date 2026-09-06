import { describe, it, test, expect } from 'vitest';
import { scoreDistribution, scoreEsg } from './etf-filter';
import { ETF } from '../../types/etf';

describe('scoreDistribution', () => {
  it('returns 15 when the ETF policy matches the desired accumulating policy', () => {
    const etf = { distributionPolicy: 'acc' } as ETF;
    const score = scoreDistribution(etf, 'acc');
    expect(score).toBe(15);
  });

  it('returns 15 when the ETF policy matches the desired distributing policy', () => {
    const etf = { distributionPolicy: 'dist' } as ETF;
    const score = scoreDistribution(etf, 'dist');
    expect(score).toBe(15);
  });

  it('returns 0 when the ETF policy is acc but dist is desired', () => {
    const etf = { distributionPolicy: 'acc' } as ETF;
    const score = scoreDistribution(etf, 'dist');
    expect(score).toBe(0);
  });

  it('returns 0 when the ETF policy is dist but acc is desired', () => {
    const etf = { distributionPolicy: 'dist' } as ETF;
    const score = scoreDistribution(etf, 'acc');
    expect(score).toBe(0);
  });
});

describe('scoreEsg', () => {
  const baseETF: ETF = {
    isin: 'IE00B4L5Y983',
    wkn: 'A0RPWH',
    name: 'iShares Core MSCI World UCITS ETF',
    ter: 0.2,
    distributionPolicy: 'acc',
    esgStatus: 'none',
    totalHoldings: 1500,
    sectorAllocation: {},
    countryAllocation: {},
    top10Holdings: [],
    performance: { return1Y: 10, return3Y: 30, volatility1Y: 15 },
    summaryTags: []
  };

  test('returns 20 when user wants "none" and ETF has "none"', () => {
    const etf: ETF = { ...baseETF, esgStatus: 'none' };
    expect(scoreEsg(etf, 'none')).toBe(20);
  });

  test('returns 10 when user wants "none" and ETF has an ESG status', () => {
    const etf8: ETF = { ...baseETF, esgStatus: 'article_8' };
    const etf9: ETF = { ...baseETF, esgStatus: 'article_9' };
    expect(scoreEsg(etf8, 'none')).toBe(10);
    expect(scoreEsg(etf9, 'none')).toBe(10);
  });

  test('returns 20 when ETF matches the requested ESG status exactly', () => {
    const etf8: ETF = { ...baseETF, esgStatus: 'article_8' };
    const etf9: ETF = { ...baseETF, esgStatus: 'article_9' };
    expect(scoreEsg(etf8, 'article_8')).toBe(20);
    expect(scoreEsg(etf9, 'article_9')).toBe(20);
  });

  test('returns 18 when user wants article_8 but ETF is article_9 (stricter upgrade)', () => {
    const etf: ETF = { ...baseETF, esgStatus: 'article_9' };
    expect(scoreEsg(etf, 'article_8')).toBe(18);
  });

  test('returns 12 when user wants article_9 but ETF is article_8 (close but less strict)', () => {
    const etf: ETF = { ...baseETF, esgStatus: 'article_8' };
    expect(scoreEsg(etf, 'article_9')).toBe(12);
  });

  test('returns 0 when user wants ESG but ETF has "none"', () => {
    const etf: ETF = { ...baseETF, esgStatus: 'none' };
    expect(scoreEsg(etf, 'article_8')).toBe(0);
    expect(scoreEsg(etf, 'article_9')).toBe(0);
  });
});
