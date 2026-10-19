// Simple in-memory rate limiter
// Note: In a real distributed system, we would use Redis or another shared store.
// Since we don't have Redis configured, we'll use a basic in-memory map.
// This works for a single instance or Vercel edge functions (though state is per-isolate).

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  ip: string,
  limit: number = 10,
  windowMs: number = 60 * 1000, // 1 minute
): RateLimitResult {
  const now = Date.now();

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // New or expired record
    const resetTime = now + windowMs;
    rateLimitStore.set(ip, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: resetTime,
    };
  }

  // Active record
  const currentCount = record.count + 1;

  if (currentCount <= limit) {
    record.count = currentCount;
  }

  return {
    success: currentCount <= limit,
    limit,
    remaining: Math.max(0, limit - currentCount),
    reset: record.resetTime,
  };
}

// Cleanup interval to prevent memory leaks in long-running processes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [ip, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
          rateLimitStore.delete(ip);
        }
      }
    },
    5 * 60 * 1000,
  ); // Clean up every 5 minutes
}
