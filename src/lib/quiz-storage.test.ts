import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadQuizAnswers,
  saveQuizAnswers,
  clearQuizAnswers,
  PersistedQuizAnswers,
} from "./quiz-storage";
import { QuizAnswers } from "@/components/etf-quiz";

const STORAGE_KEY = "etf-finder:quiz-answers:v1";

describe("quiz-storage", () => {
  const completeAnswers: QuizAnswers = {
    region: "world",
    distribution: "acc",
    esg: "any",
    risk: "balanced",
    sectorTilt: "tech",
  };

  const incompleteAnswers: QuizAnswers = {
    region: "world",
    distribution: "acc",
    esg: null,
    risk: null,
    sectorTilt: null,
  };

  // Mock localStorage
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
    // restore window if it was undefined (though Vitest env typically provides one)
    if (originalWindow === undefined) {
      delete (global as unknown as { window: Window | undefined }).window;
    }
  });

  describe("saveQuizAnswers", () => {
    it("should save complete answers to localStorage", () => {
      saveQuizAnswers(completeAnswers);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String),
      );

      const savedData = JSON.parse(
        localStorageMock.getItem(STORAGE_KEY) as string,
      ) as PersistedQuizAnswers;
      expect(savedData.answers).toEqual(completeAnswers);
      expect(typeof savedData.savedAt).toBe("string");
    });

    it("should not save incomplete answers", () => {
      saveQuizAnswers(incompleteAnswers);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("should silently catch and ignore errors when localStorage.setItem throws (e.g., quota exceeded)", () => {
      // Mock setItem to throw an error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceededError: DOM Exception 22");
      });

      // Should not throw
      expect(() => {
        saveQuizAnswers(completeAnswers);
      }).not.toThrow();

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should early return if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;

      saveQuizAnswers(completeAnswers);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      global.window = w;
    });
  });

  describe("loadQuizAnswers", () => {
    it("should load answers correctly if valid data exists", () => {
      const payload: PersistedQuizAnswers = {
        answers: completeAnswers,
        savedAt: new Date().toISOString(),
      };
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(payload));

      const loaded = loadQuizAnswers();
      expect(loaded).toEqual(completeAnswers);
    });

    it("should return null if no data exists", () => {
      expect(loadQuizAnswers()).toBeNull();
    });

    it("should return null and not throw if localStorage contains invalid JSON", () => {
      localStorageMock.setItem(STORAGE_KEY, "invalid json {");

      expect(() => {
        const result = loadQuizAnswers();
        expect(result).toBeNull();
      }).not.toThrow();
    });

    it("should return null if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;

      const result = loadQuizAnswers();
      expect(result).toBeNull();

      global.window = w;
    });
  });

  describe("clearQuizAnswers", () => {
    it("should remove the key from localStorage", () => {
      clearQuizAnswers();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("should early return if window is undefined", () => {
      const w = global.window;
      delete (global as unknown as { window: Window | undefined }).window;

      clearQuizAnswers();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();

      global.window = w;
    });
  });
});
