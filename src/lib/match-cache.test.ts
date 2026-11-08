import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadMatchRun,
  cacheMatchRun,
  clearMatchRun,
  CachedMatchRun,
} from "./match-cache";

const STORAGE_KEY = "etf-finder:match-session:v1";

describe("match-cache", () => {
  const validMatchRun: CachedMatchRun = {
    matches: [
      {
        isin: "US0000000000",
        name: "Test ETF",
        rationale: "Good fit",
      },
    ],
    session: {
      answers: {
        region: "world",
        distributionPolicy: "acc",
        esgStatus: "any",
        riskPreference: "balanced",
      },
      candidates: [
        {
          isin: "US0000000000",
          name: "Test ETF",
          summary: "Summary",
        },
      ],
      generatedAt: new Date().toISOString(),
    },
    rawAnswers: {
      region: "world",
      distribution: "acc",
      esg: "any",
      risk: "balanced",
      sectorTilt: "tech",
    },
    cachedAt: new Date().toISOString(),
  };

  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  const originalWindow = global.window;

  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow === undefined) {
      delete (global as unknown as { window: Window | undefined }).window;
    }
  });

  describe("cacheMatchRun", () => {
    it("should save match run to localStorage", () => {
      cacheMatchRun(validMatchRun);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(validMatchRun),
      );
    });

    it("should catch quota exceeded errors", () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => cacheMatchRun(validMatchRun)).not.toThrow();
    });

    it("should early return if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;
      cacheMatchRun(validMatchRun);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      global.window = w;
    });
  });

  describe("loadMatchRun", () => {
    it("should load valid data", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(validMatchRun));
      expect(loadMatchRun()).toEqual(validMatchRun);
    });

    it("should return null if no data", () => {
      expect(loadMatchRun()).toBeNull();
    });

    it("should return null on invalid JSON", () => {
      localStorageMock.setItem(STORAGE_KEY, "{ invalid");
      expect(loadMatchRun()).toBeNull();
    });

    it("should return null if missing properties", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify({}));
      expect(loadMatchRun()).toBeNull();
    });

    it("should return null if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;
      expect(loadMatchRun()).toBeNull();
      global.window = w;
    });
  });

  describe("clearMatchRun", () => {
    it("should remove item", () => {
      clearMatchRun();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("should early return if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;
      clearMatchRun();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
      global.window = w;
    });
  });
});
