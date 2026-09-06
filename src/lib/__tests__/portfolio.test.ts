import { describe, it, expect } from 'vitest';

describe('Portfolio Calculations', () => {
  it('calculates portfolio metrics correctly', () => {
    const items = [
      { id: "1", shares: 10, buy_price: 100, currency: "EUR" }, // invested: 1000 EUR
      { id: "2", shares: 5, buy_price: 110, currency: "USD" } // invested: 550 USD
    ];

    const exchangeRateEurToUsd = 1.1; // 1 EUR = 1.1 USD

    const quotes = new Map([
      ["1", { price: 120, currency: "EUR" }],
      ["2", { price: 105, currency: "USD" }]
    ]);

    let totalInvestedEUR = 0;
    let currentValueEUR = 0;

    const enrichedItems = items.map((item) => {
      let buyPriceEUR = item.buy_price;
      if (item.currency === "USD") {
        buyPriceEUR = item.buy_price / exchangeRateEurToUsd;
      }

      const investedEUR = item.shares * buyPriceEUR;
      totalInvestedEUR += investedEUR;

      const quote = quotes.get(item.id);
      let currentPriceEUR = buyPriceEUR;
      let currentPrice = item.buy_price;
      let quoteCurrency = item.currency;

      if (quote) {
        currentPrice = quote.price;
        quoteCurrency = quote.currency;

        if (quote.currency === "USD") {
          currentPriceEUR = quote.price / exchangeRateEurToUsd;
        } else if (quote.currency === "EUR") {
          currentPriceEUR = quote.price;
        }
      }

      const valueEUR = item.shares * currentPriceEUR;
      currentValueEUR += valueEUR;

      const absoluteReturnEUR = valueEUR - investedEUR;
      const percentageReturn = investedEUR > 0 ? (absoluteReturnEUR / investedEUR) * 100 : 0;

      return {
        ...item,
        current_price: currentPrice,
        quote_currency: quoteCurrency,
        invested_eur: investedEUR,
        value_eur: valueEUR,
        absolute_return_eur: absoluteReturnEUR,
        percentage_return: percentageReturn,
      };
    });

    const totalAbsoluteReturnEUR = currentValueEUR - totalInvestedEUR;
    const totalPercentageReturn = totalInvestedEUR > 0 ? (totalAbsoluteReturnEUR / totalInvestedEUR) * 100 : 0;

    // item 1: invested 1000 EUR, current value 1200 EUR. Return = +200 EUR (+20%)
    expect(enrichedItems[0].invested_eur).toBe(1000);
    expect(enrichedItems[0].value_eur).toBe(1200);
    expect(enrichedItems[0].absolute_return_eur).toBe(200);
    expect(enrichedItems[0].percentage_return).toBe(20);

    // item 2: invested 550 USD / 1.1 = 500 EUR. current value 525 USD / 1.1 = 477.27 EUR. Return = -22.73 EUR (-4.55%)
    expect(enrichedItems[1].invested_eur).toBeCloseTo(500);
    expect(enrichedItems[1].value_eur).toBeCloseTo(477.27, 2);
    expect(enrichedItems[1].absolute_return_eur).toBeCloseTo(-22.73, 2);
    expect(enrichedItems[1].percentage_return).toBeCloseTo(-4.55, 2);

    // total: invested 1500 EUR. current value = 1677.27 EUR. Return = +177.27 EUR (+11.82%)
    expect(totalInvestedEUR).toBe(1500);
    expect(currentValueEUR).toBeCloseTo(1677.27, 2);
    expect(totalAbsoluteReturnEUR).toBeCloseTo(177.27, 2);
    expect(totalPercentageReturn).toBeCloseTo(11.82, 2);
  });

  it('handles zero shares correctly', () => {
    const items = [
      { id: "1", shares: 0, buy_price: 100, currency: "EUR" },
    ];

    let totalInvestedEUR = 0;

    const enrichedItems = items.map((item) => {
      const investedEUR = item.shares * item.buy_price;
      totalInvestedEUR += investedEUR;

      const absoluteReturnEUR = 0 - investedEUR;
      const percentageReturn = investedEUR > 0 ? (absoluteReturnEUR / investedEUR) * 100 : 0;

      return { percentage_return: percentageReturn };
    });

    expect(enrichedItems[0].percentage_return).toBe(0);
    expect(totalInvestedEUR).toBe(0);
  });
});
