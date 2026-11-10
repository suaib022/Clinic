// Per-user sliding-window limiter for the queue endpoints.
// shortcut: in-memory per server instance (each Netlify function instance counts separately);
// move to a shared store (e.g. a Postgres counter table) if abuse is seen across instances.
const hits = new Map<string, number[]>();

export function allow(key: string, limit: number, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
