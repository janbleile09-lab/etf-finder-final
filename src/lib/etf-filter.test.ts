import { describe, it, expect } from 'vitest';
import { scoreDistribution, describeEtf } from './etf-filter';
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

describe('describeEtf', () => {
  const baseEtf: ETF = {
    isin: 'IE00B4L5Y983',
    wkn: 'A0RPWH',
    name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
    ter: 0.2,
    distributionPolicy: 'acc',
    esgStatus: 'none',
    totalHoldings: 1500,
    sectorAllocation: {},
    countryAllocation: {},
    top10Holdings: [],
    performance: {
      return1Y: 15.5,
      return3Y: 35.2,
      volatility1Y: 12.1,
    },
    summaryTags: ['Global', 'Large Cap', 'Developed Markets'],
  };

  it('correctly formats an accumulating, non-ESG ETF', () => {
    const etf = { ...baseEtf };
    const result = describeEtf(etf);
    expect(result).toBe(
      'ISIN: IE00B4L5Y983 | WKN: A0RPWH | Name: iShares Core MSCI World UCITS ETF USD (Acc) | TER: 0.2% | Distribution: Accumulating | ESG: None | Holdings: 1500 | Tags: Global, Large Cap, Developed Markets | 1Y Return: 15.5% | 3Y Return: 35.2% | Volatility (1Y): 12.1%'
    );
  });

  it('correctly formats a distributing, article 8 ETF', () => {
    const etf: ETF = { ...baseEtf, distributionPolicy: 'dist', esgStatus: 'article_8' };
    const result = describeEtf(etf);
    expect(result).toContain('Distribution: Distributing');
    expect(result).toContain('ESG: Article 8 (light green)');
  });

  it('correctly formats an article 9 ETF', () => {
    const etf: ETF = { ...baseEtf, esgStatus: 'article_9' };
    const result = describeEtf(etf);
    expect(result).toContain('ESG: Article 9 (dark green)');
  });

  it('correctly joins summary tags', () => {
    const etf: ETF = { ...baseEtf, summaryTags: ['Tech', 'US'] };
    const result = describeEtf(etf);
    expect(result).toContain('Tags: Tech, US');
  });

  it('handles empty summary tags', () => {
    const etf: ETF = { ...baseEtf, summaryTags: [] };
    const result = describeEtf(etf);
    expect(result).toContain('Tags:  |');
  });
});
