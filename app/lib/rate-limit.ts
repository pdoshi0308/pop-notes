// Tiny in-memory rate limiter. Sliding window keyed by string (typically an IP
// or `${ip}:${workspace_id}` for finer granularity). Survives the lifetime of
// one Node process — on Vercel Functions that's per-instance, so multiple
// concurrent instances will each allow `max` reqs. That's still 10–100x lower
// than wide-open, and enough to stop accidental loops and casual abuse.
//
// For true platform-wide limits, layer Vercel Firewall rate rules on top.

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

let lastSweep = 0;
function sweep(now: number) {
  // Cheap GC every 10s so the map can't grow unbounded.
  if (now - lastSweep < 10_000) return;
  lastSweep = now;
  for (const [key, times] of buckets) {
    const live = times.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, max: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const times = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: WINDOW_MS - (now - times[0]),
    };
  }
  times.push(now);
  buckets.set(key, times);
  return { ok: true, remaining: max - times.length, retryAfterMs: 0 };
}

export function clientIp(req: Request): string {
  // Prefer Vercel/Cloudflare-style forwarded headers; fall back to a constant
  // so the limiter still works in local dev.
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'local';
}
