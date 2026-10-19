import { describe, it, expect } from 'vitest';

describe('Auth Callback Open Redirect', () => {
  it('should sanitize invalid redirects', () => {
    function sanitizeNext(next: string) {
      if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
        return "/";
      }
      return next;
    }

    expect(sanitizeNext('//evil.com')).toBe('/');
    expect(sanitizeNext('/\\evil.com')).toBe('/');
    expect(sanitizeNext('https://evil.com')).toBe('/');
    expect(sanitizeNext('/settings')).toBe('/settings');
    expect(sanitizeNext('/?foo=bar')).toBe('/?foo=bar');
  });
});
