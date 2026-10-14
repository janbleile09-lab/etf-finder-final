import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheMatchRun, loadMatchRun, clearMatchRun, CachedMatchRun } from './match-cache';

describe('match-cache', () => {
  const STORAGE_KEY = "etf-finder:match-session:v1";

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock window and localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key) => { delete mockStorage[key]; }),
    };

    vi.stubGlobal('window', {
      localStorage: mockLocalStorage
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mockRun: CachedMatchRun = {
    matches: [
      { isin: 'US123', name: 'Test ETF', rationale: 'Good' }
    ],
    session: {
      answers: {
        region: 'world',
        distributionPolicy: 'acc',
        esgStatus: 'any',
        riskPreference: 'balanced'
      },
      candidates: [
        { isin: 'US123', name: 'Test ETF', summary: 'Summary' }
      ],
      generatedAt: '2023-01-01'
    },
    rawAnswers: {
      region: 'world',
      distribution: 'acc',
      esg: 'any',
      risk: 'balanced',
      sectorTilt: 'none'
    },
    cachedAt: '2023-01-01'
  };

  describe('cacheMatchRun', () => {
    it('should save the match run to localStorage', () => {
      cacheMatchRun(mockRun);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(mockRun)
      );
      expect(mockStorage[STORAGE_KEY]).toEqual(JSON.stringify(mockRun));
    });

    it('should handle missing window gracefully', () => {
      vi.stubGlobal('window', undefined);
      expect(() => cacheMatchRun(mockRun)).not.toThrow();
    });

    it('should handle localStorage throwing errors gracefully', () => {
      vi.mocked(window.localStorage.setItem).mockImplementationOnce(() => {
        throw new Error('Quota Exceeded');
      });
      expect(() => cacheMatchRun(mockRun)).not.toThrow();
    });
  });

  describe('loadMatchRun', () => {
    it('should return null when window is undefined', () => {
      vi.stubGlobal('window', undefined);
      expect(loadMatchRun()).toBeNull();
    });

    it('should return null when localStorage is empty', () => {
      expect(loadMatchRun()).toBeNull();
    });

    it('should return null when data is malformed JSON', () => {
      mockStorage[STORAGE_KEY] = 'invalid-json';
      expect(loadMatchRun()).toBeNull();
    });

    it('should return null when missing required fields', () => {
      mockStorage[STORAGE_KEY] = JSON.stringify({ matches: [] }); // missing session
      expect(loadMatchRun()).toBeNull();
    });

    it('should return the parsed match run when valid', () => {
      mockStorage[STORAGE_KEY] = JSON.stringify(mockRun);
      const loaded = loadMatchRun();
      expect(loaded).toEqual(mockRun);
    });
  });

  describe('clearMatchRun', () => {
    it('should remove the item from localStorage', () => {
      mockStorage[STORAGE_KEY] = 'some-data';
      clearMatchRun();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(mockStorage[STORAGE_KEY]).toBeUndefined();
    });

    it('should handle missing window gracefully', () => {
      vi.stubGlobal('window', undefined);
      expect(() => clearMatchRun()).not.toThrow();
    });

    it('should handle localStorage throwing errors gracefully', () => {
      vi.mocked(window.localStorage.removeItem).mockImplementationOnce(() => {
        throw new Error('Security Error');
      });
      expect(() => clearMatchRun()).not.toThrow();
    });
  });
});
