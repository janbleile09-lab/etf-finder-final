/**
 * Tavily Search — Phase 2 & 3 of the Hybrid RAG Pipeline.
 *
 * Phase 2: Generates targeted, ISIN-bound search queries for Tavily.
 * Phase 3: Synthesizes crawled text with strict LLM grounding rules.
 *
 * Domain Whitelist: Only official issuer sites (iShares, Xtrackers, Vanguard,
 * Amundi) and recognized data providers (JustETF, Morningstar) are allowed.
 * No financial blogs, forums, or social media.
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_BASE_URL = "https://api.tavily.com/search";

// ---------------------------------------------------------------------------
// Domain whitelist — only these domains are allowed
// ---------------------------------------------------------------------------

const DOMAIN_WHITELIST = [
  "justetf.com",
  "morningstar.de",
  "morningstar.com",
  "ishares.com",
  "xtrackers.com",
  "vanguard.com",
  "amundi.com",
  "spdr.com",
  "invesco.com",
  "hsbc.com",
  "ubs.com",
  "bnpparibas.com",
  "lyxor.com",
  "dws.com",
  "dekabank.de",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
  response_time: number;
}

export interface EnrichedETFData {
  isin: string;
  topHoldings: string | null;
  aum: string | null;
  dailyPrice: string | null;
  inceptionDate: string | null;
  fundSize: string | null;
  sources: string[];
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 2: Generate targeted search queries per ISIN
// ---------------------------------------------------------------------------

/**
 * Generates the 3 standard search patterns for a given ISIN.
 * These are designed to find specific data points that may be missing
 * from our local database.
 */
function generateSearchQueries(isin: string): string[] {
  return [
    // Pattern 1: Top Holdings
    `"${isin}" site:justetf.com OR site:morningstar.de "Top 10 Positionen"`,
    // Pattern 2: Factsheet / prospectus
    `"${isin}" site:ishares.com OR site:xtrackers.com OR site:vanguard.com OR site:amundi.com Factsheet`,
    // Pattern 3: Fund size / AUM
    `"${isin}" site:justetf.com OR site:morningstar.de Fondsvolumen OR AUM`,
  ];
}

/**
 * Filters search results to only include whitelisted domains.
 */
function filterByWhitelist(results: TavilySearchResult[]): TavilySearchResult[] {
  return results.filter((r) => {
    try {
      const hostname = new URL(r.url).hostname.replace(/^www\./, "");
      return DOMAIN_WHITELIST.some(
        (domain) => hostname === domain || hostname.endsWith("." + domain)
      );
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Tavily API call
// ---------------------------------------------------------------------------

async function tavilySearch(
  query: string,
  maxResults: number = 5
): Promise<TavilySearchResponse> {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not defined. Cannot perform search.");
  }

  const response = await fetch(TAVILY_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false,
      include_domains: DOMAIN_WHITELIST,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Phase 2+3: Search for a single ISIN and extract structured data
// ---------------------------------------------------------------------------

/**
 * Searches for enriched data about a single ETF by ISIN.
 * Runs all 3 search patterns, filters by whitelist, and extracts
 * structured data points from the crawled text.
 */
export async function enrichSingleETF(isin: string): Promise<EnrichedETFData> {
  const queries = generateSearchQueries(isin);
  const allResults: TavilySearchResult[] = [];
  const allSources: string[] = [];

  // Run all queries (sequentially to avoid rate limiting)
  for (const query of queries) {
    try {
      const response = await tavilySearch(query, 3);
      const filtered = filterByWhitelist(response.results);
      allResults.push(...filtered);
      for (const r of filtered) {
        if (!allSources.includes(r.url)) {
          allSources.push(r.url);
        }
      }
    } catch (error) {
      console.warn(`Tavily search failed for query "${query}":`, error);
      // Continue with other queries even if one fails
    }
  }

  // Combine all crawled text into one context block
  const combinedText = allResults
    .map((r) => `[Source: ${r.url}]\n${r.content}`)
    .join("\n\n---\n\n");

  // Extract structured data from the combined text
  const data = extractDataFromText(combinedText);

  return {
    isin,
    topHoldings: data.topHoldings,
    aum: data.aum,
    dailyPrice: data.dailyPrice,
    inceptionDate: data.inceptionDate,
    fundSize: data.fundSize,
    sources: allSources,
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Batch enrich multiple ETFs.
 */
export async function enrichMultipleETFs(
  isins: string[]
): Promise<Map<string, EnrichedETFData>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY is missing. Skipping web search enrichment.");
    return new Map();
  }

  const results = new Map<string, EnrichedETFData>();

  // Process sequentially to respect rate limits
  for (const isin of isins) {
    try {
      const data = await enrichSingleETF(isin);
      results.set(isin, data);
    } catch (error) {
      console.warn(`Failed to enrich ${isin}:`, error);
      // Return a minimal result on failure
      results.set(isin, {
        isin,
        topHoldings: null,
        aum: null,
        dailyPrice: null,
        inceptionDate: null,
        fundSize: null,
        sources: [],
        searchedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Phase 3: Extract structured data from crawled text
// ---------------------------------------------------------------------------

interface ExtractedData {
  topHoldings: string | null;
  aum: string | null;
  dailyPrice: string | null;
  inceptionDate: string | null;
  fundSize: string | null;
}

/**
 * Deterministic text extraction from crawled content.
 * Uses regex patterns to find specific data points + field validation.
 * Returns null for any field that cannot be reliably extracted.
 */
function extractDataFromText(text: string): ExtractedData {
  if (!text || text.trim().length === 0) {
    return { topHoldings: null, aum: null, dailyPrice: null, inceptionDate: null, fundSize: null };
  }

  const rawAum = extractAUM(text);
  const rawPrice = extractDailyPrice(text);

  // Extract then validate
  const validatedAum = validateFundSize(rawAum, rawPrice);
  const validatedPrice = validateDailyPrice(rawPrice);

  return {
    topHoldings: extractHoldings(text),
    aum: validatedAum,
    dailyPrice: validatedPrice,
    inceptionDate: validateInceptionDate(extractInceptionDate(text)),
    fundSize: validatedAum,
  };
}

// ---------------------------------------------------------------------------
// Field validators
// ---------------------------------------------------------------------------

/**
 * Minimum plausible AUM values for different ETF types.
 * Core ETFs (S&P 500, MSCI World, etc.) typically have > 100 Mio EUR.
 * Niche/ESG ETFs can be smaller but still > 10 Mio EUR.
 */
const MIN_PLAUSIBLE_AUM_MIO = 10; // 10 Mio EUR minimum for any ETF

/**
 * Parse a German/English numeric string with thousand separators.
 * Handles: "12.345,67", "12,345.67", "12345.67", "12345"
 */
function parseNumericString(raw: string): number | null {
  if (!raw) return null;

  // Remove currency symbols, whitespace, and trailing text
  let cleaned = raw
    .replace(/EUR|USD|€|\$/gi, "")
    .replace(/Mio\.?|Millionen|Mrd\.?|Milliarden|Bn\b|\bB\b|\bM\b/gi, "")
    .trim();

  // Detect German vs English format
  // German: 1.234,56 (dot = thousand, comma = decimal)
  // English: 1,234.56 (comma = thousand, dot = decimal)
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Both present — check which comes last (decimal separator)
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // German format: 1.234,56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // English format: 1,234.56
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Only comma: could be German decimal (123,45) or thousand (1,234)
    // If comma is followed by exactly 2 digits, treat as decimal
    if (/,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  // else: only dots or no separators — treat as-is

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a unit multiplier from the raw string.
 * Returns 1 for plain numbers, 1_000_000 for "Mio", 1_000_000_000 for "Mrd".
 */
function parseUnitMultiplier(raw: string): number {
  if (/Mrd\.?|Milliarden|Bn\b|\bB\b/i.test(raw)) return 1_000_000_000;
  if (/Mio\.?|Millionen|\bM\b/i.test(raw)) return 1_000_000;
  return 1; // Plain number (no unit)
}

/**
 * Validate fund size / AUM.
 *
 * Rules:
 * 1. Must be a number with a unit (Mio, Mrd, Bn) — plain numbers are rejected
 *    (they could be daily prices, TER, or other metrics).
 * 2. Must be ≥ MIN_PLAUSIBLE_AUM_MIO (10 Mio EUR).
 * 3. Must not be confused with daily price (price typically has no Mio/Mrd unit).
 * 4. If a daily price was also extracted from the same text, double-check
 *    that we didn't accidentally capture the price as AUM.
 */
function validateFundSize(rawAum: string | null, rawPrice: string | null): string | null {
  if (!rawAum) return null;

  // Rule 1: Must have a unit indicator (Mio, Mrd, Million, Milliarde, Bn, B)
  const hasUnit = /Mio\.?|Mrd\.?|Millionen|Milliarden|Bn\b|\bB\b|M\b/i.test(rawAum);
  if (!hasUnit) {
    // Plain number without unit — could be a price, TER, or anything else
    return null;
  }

  const num = parseNumericString(rawAum);
  if (num === null) return null;

  const multiplier = parseUnitMultiplier(rawAum);
  const aumInEUR = num * multiplier;

  // Rule 2: Plausibility check
  const aumInMio = aumInEUR / 1_000_000;
  if (aumInMio < MIN_PLAUSIBLE_AUM_MIO) {
    console.warn(
      `AUM validation: ${rawAum.trim()} → ${aumInMio.toFixed(1)} Mio EUR — below minimum threshold of ${MIN_PLAUSIBLE_AUM_MIO} Mio EUR. Rejecting.`
    );
    return null;
  }

  // Rule 3: If we also extracted a price, ensure they're not the same value
  if (rawPrice) {
    const priceNum = parseNumericString(rawPrice);
    if (priceNum !== null && Math.abs(num - priceNum) < 0.01) {
      // Same value extracted for both AUM and price — likely a false positive
      console.warn(
        `AUM validation: ${rawAum.trim()} matches daily price ${rawPrice.trim()} — likely a false positive. Rejecting AUM.`
      );
      return null;
    }
  }

  // Rule 4: Sanity check — no single ETF should have > 500 Mrd EUR AUM
  if (aumInEUR > 500_000_000_000) {
    console.warn(
      `AUM validation: ${rawAum.trim()} → ${(aumInEUR / 1e9).toFixed(1)} Mrd EUR — exceeds maximum plausible AUM (500 Mrd). Rejecting.`
    );
    return null;
  }

  // Format for display
  if (aumInEUR >= 1_000_000_000) {
    return `${(aumInEUR / 1_000_000_000).toFixed(1)} Mrd. EUR`;
  }
  return `${Math.round(aumInEUR / 1_000_000).toLocaleString("de-DE")} Mio. EUR`;
}

/**
 * Validate daily price.
 *
 * Rules:
 * 1. Must be a reasonable price for an ETF share (€1 – €10,000).
 * 2. Must not have a unit like Mio/Mrd (those are fund sizes, not prices).
 */
function validateDailyPrice(rawPrice: string | null): string | null {
  if (!rawPrice) return null;

  // Rule 1: Must not have a fund-size unit
  if (/Mio\.?|Mrd\.?|Millionen|Milliarden|Bn\b|\bB\b/i.test(rawPrice)) {
    return null; // This is a fund size, not a price
  }

  const num = parseNumericString(rawPrice);
  if (num === null) return null;

  // Rule 2: Price must be between 1 and 10,000 EUR
  if (num < 1 || num > 10_000) {
    console.warn(
      `Price validation: ${rawPrice.trim()} → ${num} — outside plausible range (1–10,000). Rejecting.`
    );
    return null;
  }

  // Determine currency
  if (/EUR|€/i.test(rawPrice)) return `${num.toFixed(2)} EUR`;
  if (/USD|\$/i.test(rawPrice)) return `${num.toFixed(2)} USD`;

  return `${num.toFixed(2)} EUR`;
}

/**
 * Validate inception date.
 *
 * Rules:
 * 1. Year must be between 1990 and current year.
 * 2. Date must be parseable.
 */
function validateInceptionDate(rawDate: string | null): string | null {
  if (!rawDate) return null;

  // Extract year
  const yearMatch = rawDate.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;

  const year = parseInt(yearMatch[0], 10);
  const currentYear = new Date().getFullYear();

  if (year < 1990 || year > currentYear) {
    console.warn(
      `Inception date validation: ${rawDate} → year ${year} outside plausible range (1990–${currentYear}). Rejecting.`
    );
    return null;
  }

  return rawDate.trim();
}

/**
 * Extract top holdings from text.
 * Looks for patterns like:
 * - "Top 10 Positionen" followed by company names and percentages
 * - "Apple Inc. 5,2%"
 * - Table-like structures with holdings
 */
function extractHoldings(text: string): string | null {
  const holdingsSection = findSection(text, [
    "Top 10 Positionen",
    "Top Holdings",
    "Top Positionen",
    "Größte Positionen",
    "Largest Holdings",
    "Top 10 Holdings",
  ]);

  if (holdingsSection) {
    // Try to extract individual holding lines
    const holdingPattern =
      /(?:Apple|Microsoft|NVIDIA|Amazon|Meta|Alphabet|Tesla|Broadcom|Eli Lilly|JPMorgan|Johnson & Johnson|Visa|Procter & Gamble|UnitedHealth|Mastercard|Exxon|Home Depot|Costco|AbbVie|Chevron|Coca-Cola|PepsiCo|Merck|Bank of America|Adobe|Salesforce|Oracle|Cisco|Netflix|Comcast|Walmart|Pfizer|Walt Disney|Abbott|Intel|Verizon|AT&T|Thermo Fisher|McDonald's|Accenture|Linde|Bristol-Myers|Nike|Texas Instruments|Qualcomm|General Electric|Raytheon|Caterpillar|Union Pacific|Honeywell|Lockheed Martin|American Express|Morgan Stanley|Goldman Sachs|ASML|SAP|Siemens|Allianz|LVMH|Nestle|Roche|Novartis|Novo Nordisk|AstraZeneca|Shell|HSBC|Unilever|BP|TotalEnergies|Sanofi|L'Oréal|Toyota|Samsung|TSMC|Tencent|Alibaba|Reliance|Taiwan Semiconductor)[\s\w.'&-]*\s+[\d]{1,2}[,.]\d{1,2}\s*%/gi;

    const matches = holdingsSection.match(holdingPattern);
    if (matches && matches.length >= 3) {
      return matches.slice(0, 10).join("; ");
    }
  }

  return null;
}

/**
 * Extract AUM / fund size from text.
 *
 * More precise patterns — we require the keyword to be in close proximity
 * (within 30 chars) to the number, and the number must have a unit.
 */
function extractAUM(text: string): string | null {
  const aumPatterns = [
    // Pattern 1: "Fondsvolumen: 12.345 Mio. EUR" (keyword THEN number)
    // Allow up to 30 chars between keyword and number (handles "beträgt", "$", etc.)
    /(?:Fondsvolumen|Fondsvermögen|AUM|Assets under Management|Fund Size|Fondsgröße)[\s\S]{0,30}?([\d.]{1,10}(?:[.,]\d{1,3})?\s*(?:Mio\.?|Mrd\.?|Millionen|Milliarden|Bn\b|\bB\b|\bM\b)\s*(?:EUR|USD|€|\$)?)/gi,
    // Pattern 2: "12.345 Mio. EUR Fondsvolumen" (number THEN keyword)
    /([\d.]{1,10}(?:[.,]\d{1,3})?\s*(?:Mio\.?|Mrd\.?|Millionen|Milliarden|Bn\b|\bB\b|\bM\b)\s*(?:EUR|USD|€|\$)?)[\s\S]{0,30}(?:Fondsvolumen|Fondsvermögen|AUM|Fondsgröße)/gi,
  ];

  for (const pattern of aumPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const raw = match[1].trim();
      if (/Mio\.?|Mrd\.?|Millionen|Milliarden|Bn\b|\bB\b|\bM\b/i.test(raw)) {
        return raw;
      }
    }
  }

  return null;
}

/**
 * Extract daily price.
 * Looks for patterns like:
 * - "Kurs: 123,45 EUR"
 * - "Price: $456.78"
 */
function extractDailyPrice(text: string): string | null {
  const pricePatterns = [
    /(?:Kurs|Price|Aktueller Kurs|NAV|Net Asset Value)[:\s]*([\d.,]+\s*(?:EUR|USD|€|\$))/gi,
    /([\d.,]+\s*(?:EUR|USD|€|\$))[\s\S]{0,30}(?:Kurs|Price|NAV)/gi,
  ];

  for (const pattern of pricePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract inception date.
 * Looks for patterns like:
 * - "Auflagedatum: 01.01.2010"
 * - "Inception Date: 2010-01-01"
 */
function extractInceptionDate(text: string): string | null {
  const datePatterns = [
    /(?:Auflagedatum|Inception Date|Launch Date|Auflegungsdatum|Fondsauflage)[:\s]*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{4})/gi,
  ];

  for (const pattern of datePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Find a section of text that contains one of the given headings.
 */
function findSection(text: string, headings: string[]): string | null {
  for (const heading of headings) {
    const idx = text.indexOf(heading);
    if (idx !== -1) {
      // Extract ~500 characters after the heading
      return text.substring(idx, idx + 800);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// System prompt for the LLM enrichment pass (Phase 3 — LLM Grounding)
// ---------------------------------------------------------------------------

export const ENRICHMENT_SYSTEM_PROMPT = `Du bist ein Daten-Extraktor für Finanzdaten. Du erhältst Text-Snippets aus offiziellen Finanzquellen (JustETF, Morningstar, Emittenten-Webseiten) zu einer bestimmten ISIN.

🚨 STRENGE REGELN:

1. Extrahiere AUSSCHLIESSLICH explizit genannte Zahlen und Fakten.
2. Wenn eine Information im Text fehlt, schreibe "Nicht verfügbar". Erfinde oder schätze NIEMALS Werte.
3. Vergleiche NIEMALS Daten aus verschiedenen ISIN-Kontexten.
4. Jede Zahl MUSS exakt aus dem Quelltext stammen — keine Rundung, keine Umrechnung.
5. Keine Interpretation, keine Analyse, kein Marketing — nur reine Datenextraktion.

Erlaubte Quellen:
- JustETF (justetf.com)
- Morningstar (morningstar.de, morningstar.com)
- iShares / BlackRock (ishares.com)
- Xtrackers / DWS (xtrackers.com, dws.com)
- Vanguard (vanguard.com)
- Amundi (amundi.com)

Nicht erlaubt: Finanzblogs, Foren, soziale Medien, Nachrichtenseiten.`;