import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearMatchRun } from "./match-cache";

const STORAGE_KEY = "etf-finder:match-session:v1";

describe("match-cache", () => {
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

  describe("clearMatchRun", () => {
    it("should remove the key from localStorage", () => {
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

    it("should silently catch and ignore errors when localStorage.removeItem throws", () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Some error");
      });

      expect(() => {
        clearMatchRun();
      }).not.toThrow();
    });
  });
});
