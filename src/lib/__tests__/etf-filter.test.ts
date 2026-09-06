import { describe, it, expect } from 'vitest';
import { describeScoredEtf } from '../etf-filter';

describe('describeScoredEtf', () => {
  it('should format a fully populated ScoredETF correctly', () => {
    // Setup dummy data
    const dummyScoredEtf = {
      etf: {
        isin: 'IE00B4L5Y983',
        wkn: 'A0RPWH',
        name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
        ter: 0.20,
        distributionPolicy: 'acc' as const,
        esgStatus: 'article_8' as const,
        totalHoldings: 1500,
        performance: {
          return1Y: 15.5,
          return3Y: 35.2,
          volatility1Y: 12.1
        },
        summaryTags: ['Global', 'Large Cap', 'Developed Markets'],
        sectorAllocation: {
          'Technology': 25.5,
          'Financials': 15.2,
          'Healthcare': 12.8,
          'Consumer Discretionary': 10.5,
          'Industrials': 9.2,
          'Energy': 5.1 // Should be excluded as it's the 6th
        },
        countryAllocation: {
          'United States': 68.5,
          'Japan': 6.2,
          'United Kingdom': 4.1,
          'France': 3.2,
          'Canada': 3.1,
          'Switzerland': 2.5 // Should be excluded
        },
        top10Holdings: [
          { name: 'Apple Inc.', weight: 4.5 },
          { name: 'Microsoft Corp', weight: 4.2 },
          { name: 'Amazon.com Inc.', weight: 2.1 },
          { name: 'NVIDIA Corp', weight: 1.8 },
          { name: 'Alphabet Inc. Class A', weight: 1.2 },
          { name: 'Tesla Inc', weight: 1.0 } // Should be excluded
        ]
      },
      score: 85,
      breakdown: {
        region: 25,
        distribution: 15,
        esg: 15, // Actually esg is 20, but using dummy data
        risk: 15,
        tilt: 15
      }
    };

    const result = describeScoredEtf(dummyScoredEtf as any);

    expect(result).toContain('ISIN: IE00B4L5Y983');
    expect(result).toContain('WKN: A0RPWH');
    expect(result).toContain('Name: iShares Core MSCI World UCITS ETF USD (Acc)');
    expect(result).toContain('TER: 0.2% p.a.');
    expect(result).toContain('Ausschüttung: Thesaurierend');
    expect(result).toContain('ESG: Artikel 8 (hellgrün)');
    expect(result).toContain('Anzahl Positionen: 1500');
    expect(result).toContain('1-Jahres-Rendite: 15.5%');
    expect(result).toContain('3-Jahres-Rendite: 35.2%');
    expect(result).toContain('1-Jahres-Volatilität: 12.1%');
    expect(result).toContain('MATCH-SCORE: 85/100 (Region: 25/25, Ausschüttung: 15/15, ESG: 15/20, Risiko: 15/20, Sektor: 15/20)');

    // Check formatting of tops (sorted descending and limited to 5)
    expect(result).toContain('Top 5 Sektoren: Technology: 25.5%, Financials: 15.2%, Healthcare: 12.8%, Consumer Discretionary: 10.5%, Industrials: 9.2%');
    expect(result).not.toContain('Energy: 5.1%');

    expect(result).toContain('Top 5 Länder: United States: 68.5%, Japan: 6.2%, United Kingdom: 4.1%, France: 3.2%, Canada: 3.1%');
    expect(result).not.toContain('Switzerland: 2.5%');

    expect(result).toContain('Top 5 Holdings: Apple Inc.: 4.5%, Microsoft Corp: 4.2%, Amazon.com Inc.: 2.1%, NVIDIA Corp: 1.8%, Alphabet Inc. Class A: 1.2%');
    expect(result).not.toContain('Tesla Inc: 1.0%');

    expect(result).toContain('Tags: Global, Large Cap, Developed Markets');
  });

  it('should handle optional/missing fields gracefully', () => {
    const dummyScoredEtf = {
      etf: {
        isin: 'LU0123456789',
        wkn: 'XYZ123',
        name: 'Empty ETF',
        ter: 0.15,
        distributionPolicy: 'dist' as const,
        esgStatus: 'none' as const,
        totalHoldings: 50,
        performance: {
          return1Y: 5.0,
          return3Y: 15.0,
          volatility1Y: 10.0
        },
        summaryTags: ['Bond'],
        // Missing allocations and top holdings
      },
      score: 40,
      breakdown: {
        region: 10,
        distribution: 0,
        esg: 10,
        risk: 10,
        tilt: 10
      }
    };

    const result = describeScoredEtf(dummyScoredEtf as any);

    expect(result).toContain('Ausschüttung: Ausschüttend');
    expect(result).toContain('ESG: Keine');
    expect(result).toContain('Top 5 Sektoren: Nicht verfügbar'); // Because Object.entries(undefined || {}) is empty string, which evaluates to false, thus "Nicht verfügbar"
    expect(result).not.toContain('Top 5 Länder:'); // Conditional in code
    expect(result).not.toContain('Top 5 Holdings:'); // Conditional in code
  });

  it('should handle article_9 ESG status correctly', () => {
    const dummyScoredEtf = {
      etf: {
        isin: 'LU0123456789',
        wkn: 'XYZ123',
        name: 'Green ETF',
        ter: 0.15,
        distributionPolicy: 'dist' as const,
        esgStatus: 'article_9' as const,
        totalHoldings: 50,
        performance: { return1Y: 5, return3Y: 15, volatility1Y: 10 },
        summaryTags: [],
      },
      score: 100,
      breakdown: { region: 25, distribution: 15, esg: 20, risk: 20, tilt: 20 }
    };
    const result = describeScoredEtf(dummyScoredEtf as any);
    expect(result).toContain('ESG: Artikel 9 (dunkelgrün)');
  });
});
