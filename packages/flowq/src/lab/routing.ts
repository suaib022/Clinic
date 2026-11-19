/**
 * Order in which a patient with tests in several lines should visit them.
 * "Must go first" tests (for example fasting blood) lead; then the shortest expected wait; ties by line id.
 * Closed lines (wait Infinity) go last and are never dropped, so staff still see them.
 */
export function suggestRoute(pending: { lineId: string; mustFirst: boolean }[], waits: Record<string, number>): string[] {
  const lines = new Map<string, boolean>();
  for (const p of pending) lines.set(p.lineId, (lines.get(p.lineId) ?? false) || p.mustFirst);
  const wait = (id: string) => waits[id] ?? Infinity;
  return [...lines.entries()]
    .sort(([a, fa], [b, fb]) => {
      const ca = wait(a) === Infinity, cb = wait(b) === Infinity;
      if (ca !== cb) return ca ? 1 : -1;
      if (fa !== fb) return fa ? -1 : 1;
      return wait(a) - wait(b) || a.localeCompare(b);
    })
    .map(([id]) => id);
}

export interface LookaheadLine {
  lineId: string;
  mustFirst: boolean;
  /** Expected wait if the patient joined now (minutes; Infinity = closed). */
  waitMin: number;
  /** Expected minutes at the counter. */
  serviceMin: number;
  /** How fast the wait changes per minute (arrival rate x service time - 1 while busy); positive = growing queue. */
  driftPerMin: number;
}

/**
 * Look-ahead routing: try every order of the patient's lines (must-go-first lines first, closed lines last) and pick the one
 * that finishes soonest, projecting each line's wait forward with its drift: wait(t) = max(0, wait + drift x t).
 * Unlike suggestRoute it accounts for queues that grow or shrink while the patient is at another line.
 * More than 6 open lines fall back to suggestRoute (6! = 720 orders is the limit).
 */
export function suggestRouteLookahead(lines: LookaheadLine[]): string[] {
  const byId = new Map<string, LookaheadLine>();
  for (const l of lines) {
    const prev = byId.get(l.lineId);
    byId.set(l.lineId, prev ? { ...prev, mustFirst: prev.mustFirst || l.mustFirst } : l);
  }
  const all = [...byId.values()];
  const closed = all.filter((l) => l.waitMin === Infinity).map((l) => l.lineId).sort();
  const open = all.filter((l) => l.waitMin !== Infinity);
  if (open.length > 6) {
    return suggestRoute(all.map((l) => ({ lineId: l.lineId, mustFirst: l.mustFirst })), Object.fromEntries(all.map((l) => [l.lineId, l.waitMin])));
  }
  const first = open.filter((l) => l.mustFirst), rest = open.filter((l) => !l.mustFirst);
  const finish = (order: LookaheadLine[]) => {
    let t = 0;
    for (const l of order) t += Math.max(0, l.waitMin + l.driftPerMin * t) + l.serviceMin;
    return t;
  };
  let best: LookaheadLine[] = [], bestT = Infinity;
  for (const a of permutations(first)) {
    for (const b of permutations(rest)) {
      const order = [...a, ...b], t = finish(order);
      if (t < bestT - 1e-9 || (Math.abs(t - bestT) <= 1e-9 && tieBefore(order, best))) { best = order; bestT = t; }
    }
  }
  return [...best.map((l) => l.lineId), ...closed];
}

/** Equal finish times: shorter current wait first (as suggestRoute), then line id. */
function tieBefore(a: LookaheadLine[], b: LookaheadLine[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i].waitMin !== b[i].waitMin) return a[i].waitMin < b[i].waitMin;
    if (a[i].lineId !== b[i].lineId) return a[i].lineId < b[i].lineId;
  }
  return false;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}
