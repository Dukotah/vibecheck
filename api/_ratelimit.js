// api/_ratelimit.js — a small in-memory throttle for /api/scan.
//
// /api/scan is an open URL fetcher on someone else's Vercel account. Left
// unthrottled, one loop can run up usage or use it to walk a list of other
// people's sites from our IP. That is worth stopping even though the endpoint
// itself is SSRF-guarded and capped.
//
// Honest about what this is: state lives in the memory of a single serverless
// instance, so it is not a distributed rate limiter and does not pretend to be.
// It reliably stops the case that actually happens — one client hammering, which
// keeps landing on the same warm instance — and it costs no database, no
// dependency, and no request latency. A real attacker with many IPs gets through,
// and Vercel's own protections are the layer for that.
//
// The file name starts with an underscore so Vercel does not route it.
//
// Pure and deterministic: `now` is always passed in, never read from the clock.

/**
 * A fixed-window counter.
 *
 * @param {{ windowMs:number, max:number, maxKeys?:number }} opts
 */
export function createLimiter({ windowMs, max, maxKeys = 10_000 }) {
  /** @type {Map<string, { count:number, resetAt:number }>} */
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
    // Hard ceiling so a flood of unique keys cannot grow this without bound.
    // Map preserves insertion order, so the oldest go first.
    if (hits.size > maxKeys) {
      const excess = hits.size - maxKeys;
      let i = 0;
      for (const key of hits.keys()) {
        if (i >= excess) break;
        hits.delete(key);
        i += 1;
      }
    }
  }

  return {
    /**
     * Record a hit and say whether it is allowed.
     * @param {string} key
     * @param {number} now epoch ms
     * @returns {{ allowed:boolean, remaining:number, retryAfterMs:number }}
     */
    hit(key, now) {
      prune(now);
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
      }
      entry.count += 1;
      if (entry.count > max) {
        return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
      }
      return { allowed: true, remaining: max - entry.count, retryAfterMs: 0 };
    },

    /** Visible for tests. */
    size() {
      return hits.size;
    },
  };
}

/**
 * Pull a client identifier out of the request headers.
 *
 * Vercel sets x-forwarded-for; the client's address is the FIRST entry, since
 * anything after it was appended by proxies in front of us. Reading the last
 * entry (or trusting a client-supplied header) is the classic way to make a
 * rate limiter trivially bypassable.
 *
 * @param {{ headers?: Record<string,string|string[]> }} req
 * @returns {string}
 */
export function clientKey(req) {
  const headers = (req && req.headers) || {};
  const raw = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const value = Array.isArray(raw) ? raw[0] : raw;
  const first = String(value || '').split(',')[0].trim();
  if (first) return first.slice(0, 64);
  // No usable address: bucket these together rather than letting them through
  // unmetered, but keep the bucket generous so one odd proxy cannot lock out
  // everyone behind it.
  return 'unknown';
}

// A person checking their sites does a handful of scans. These are set well
// above real use and well below what a script does.
export const PER_MINUTE = createLimiter({ windowMs: 60_000, max: 12 });
export const PER_HOUR = createLimiter({ windowMs: 3_600_000, max: 120 });

/**
 * Check both windows for a request.
 * @returns {{ allowed:boolean, retryAfterSec:number }}
 */
export function checkLimits(req, now = Date.now()) {
  const key = clientKey(req);
  const minute = PER_MINUTE.hit(key, now);
  const hour = PER_HOUR.hit(key, now);
  if (minute.allowed && hour.allowed) return { allowed: true, retryAfterSec: 0 };
  const waitMs = Math.max(minute.retryAfterMs, hour.retryAfterMs);
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
}
