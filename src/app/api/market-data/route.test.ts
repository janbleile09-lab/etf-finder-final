import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({ data: [], error: null })),
      })),
    })),
  })),
}));

vi.mock("@/lib/twelvedata", () => ({
  fetchQuotes: vi.fn(() => new Map()),
}));

// Provide mock API key for test environment
process.env.TWELVE_DATA_API_KEY = "test_key";

describe("Market Data API - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Since rate limiter is in-memory and shared, we mock Date.now to control time
    // if needed, or we just hit it 16 times rapidly.
    // To ensure a clean state between test runs, we can wait a bit or use a fresh IP per test run.
  });

  const createMockRequest = (ip: string) => {
    return new NextRequest("http://localhost:3000/api/market-data", {
      method: "POST",
      headers: {
        "x-forwarded-for": ip,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        etfs: [{ isin: "US0378331005", name: "Apple Inc." }],
      }),
    });
  };

  it("should allow requests within the rate limit", async () => {
    const ip = "192.168.1.100"; // Unique IP for this test
    const req = createMockRequest(ip);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("should block requests exceeding the rate limit", async () => {
    const ip = "192.168.1.101"; // Unique IP for this test
    let res;

    // Hit the limit (15 requests allowed)
    for (let i = 0; i < 15; i++) {
      res = await POST(createMockRequest(ip));
      expect(res.status).toBe(200);
    }

    // 16th request should fail
    res = await POST(createMockRequest(ip));
    expect(res.status).toBe(429);

    const data = await res.json();
    expect(data.error).toBe("Too many requests. Please try again later.");

    // Check headers
    expect(res.headers.get("X-RateLimit-Limit")).toBe("15");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
