import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuizAnswers } from './quiz-storage';

const STORAGE_KEY = "etf-finder:quiz-answers:v1";

describe('loadQuizAnswers', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('returns null if window is undefined', () => {
    // Simulate window being undefined by mocking global
    const originalWindow = global.window;
    // @ts-expect-error simulating environment without window
    delete global.window;

    expect(loadQuizAnswers()).toBeNull();

    // Restore window
    global.window = originalWindow;
  });

  it('returns null when localStorage is empty', () => {
    expect(loadQuizAnswers()).toBeNull();
  });

  it('returns null when the JSON in localStorage is invalid/corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ invalid json');
    expect(loadQuizAnswers()).toBeNull();
  });

  it('returns null when the JSON is valid but does not match expected structure', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wrongKey: 'data' }));
    expect(loadQuizAnswers()).toBeNull();
  });

  it('returns null when the parsed object is null', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
    expect(loadQuizAnswers()).toBeNull();
  });

  it('returns the answers object correctly when localStorage has valid data', () => {
    const validData = {
      answers: {
        region: 'Global',
        distribution: 'Accumulating',
        esg: false,
        risk: 'Medium',
        sectorTilt: 'None'
      },
      savedAt: new Date().toISOString()
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validData));

    expect(loadQuizAnswers()).toEqual(validData.answers);
  });

  it('returns null if localStorage throws an exception (simulating disabled cookies/storage)', () => {
    // Mock localStorage.getItem to throw an error
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Access is denied for this document');
    });

    expect(loadQuizAnswers()).toBeNull();
  });
});
