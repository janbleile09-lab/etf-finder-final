export interface TopHolding {
  name: string;
  weight: number;
}

export interface Performance {
  return1Y: number;
  return3Y: number;
  volatility1Y: number;
}

export interface ETF {
  isin: string;
  wkn: string;
  name: string;
  ter: number;
  distributionPolicy: 'acc' | 'dist';
  esgStatus: 'none' | 'article_8' | 'article_9';
  totalHoldings: number;
  sectorAllocation: Record<string, number>;
  countryAllocation: Record<string, number>;
  top10Holdings: TopHolding[];
  performance: Performance;
  summaryTags: string[];
}
