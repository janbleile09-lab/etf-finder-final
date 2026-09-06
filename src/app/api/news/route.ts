import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

// Cache RSS feed for 30 minutes
const getCachedNews = unstable_cache(
  async () => {
    // Yahoo Finance general news feed (or specific ticker like ^GSPC)
    const url = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC,^DJI,^IXIC,^GDAXI,URTH";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status}`);
    }
    const xml = await response.text();
    return xml;
  },
  ["financial-news-rss"],
  { revalidate: 1800 }
);

export async function GET() {
  try {
    const xml = await getCachedNews();

    // Simple regex parser for RSS (since we don't have an XML parser lib installed)
    const items: Array<Record<string, string>> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 5) break; // only take top 5
      const itemContent = match[1];

      const titleMatch = itemContent.match(titleRegex);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : "No Title";

      const linkMatch = itemContent.match(linkRegex);
      const link = linkMatch ? linkMatch[1] : "#";

      const pubDateMatch = itemContent.match(pubDateRegex);
      const pubDate = pubDateMatch ? pubDateMatch[1] : "";

      items.push({
        id: link,
        title,
        link,
        pubDate,
      });
    }

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error("Error fetching news:", error);
    // Graceful degradation: return empty array instead of 500 error
    return NextResponse.json({ items: [] });
  }
}
