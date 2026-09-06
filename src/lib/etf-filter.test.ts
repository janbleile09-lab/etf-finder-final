import { describe, it, expect } from 'vitest';
import { scoreDistribution } from './etf-filter';
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
