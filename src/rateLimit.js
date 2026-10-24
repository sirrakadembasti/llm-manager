export function createRateLimiter({ capacity = 30, refillPerSec = 0.5, maxKeys = 10000 } = {}) {
  const buckets = new Map();

  function cleanupOldest() {
    if (buckets.size <= maxKeys) return;
    const now = Date.now();
    // First pass: remove fully replenished buckets
    for (const [key, entry] of buckets) {
      const elapsed = (now - entry.lastRefill) / 1000;
      if (entry.tokens + elapsed * refillPerSec >= capacity) {
        buckets.delete(key);
      }
    }
    // If still too large, delete oldest 20%
    if (buckets.size > maxKeys) {
      const toDelete = Math.floor(maxKeys * 0.2);
      let count = 0;
      for (const key of buckets.keys()) {
        buckets.delete(key);
        if (++count >= toDelete) break;
      }
    }
  }

  return {
    take(key, count = 1) {
      const now = Date.now();
      let entry = buckets.get(key);

      if (!entry) {
        entry = { tokens: capacity, lastRefill: now };
        buckets.set(key, entry);
        cleanupOldest();
      } else {
        const elapsed = (now - entry.lastRefill) / 1000;
        entry.tokens = Math.min(capacity, entry.tokens + elapsed * refillPerSec);
        entry.lastRefill = now;
      }

      if (entry.tokens >= count) {
        entry.tokens -= count;
        return {
          ok: true,
          remaining: Math.floor(entry.tokens),
          retryAfterSec: 0
        };
      }

      const deficit = count - entry.tokens;
      const retryAfterSec = Math.max(1, Math.ceil(deficit / (refillPerSec || 1)));
      return {
        ok: false,
        remaining: 0,
        retryAfterSec
      };
    },

    check(key, count = 1) {
      const now = Date.now();
      const entry = buckets.get(key);
      if (!entry) {
        return {
          ok: capacity >= count,
          remaining: capacity,
          retryAfterSec: 0
        };
      }
      const elapsed = (now - entry.lastRefill) / 1000;
      const currentTokens = Math.min(capacity, entry.tokens + elapsed * refillPerSec);
      if (currentTokens >= count) {
        return {
          ok: true,
          remaining: Math.floor(currentTokens),
          retryAfterSec: 0
        };
      }
      const deficit = count - currentTokens;
      const retryAfterSec = Math.max(1, Math.ceil(deficit / (refillPerSec || 1)));
      return {
        ok: false,
        remaining: 0,
        retryAfterSec
      };
    },

    reset(key) {
      buckets.delete(key);
    },

    size() {
      return buckets.size;
    }
  };
}
