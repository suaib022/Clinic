import { suggestRoute } from '../lab/routing';
import type { Rng } from './rng';

/** What each patient is told: the engine, or a simpler baseline. */
export type EtaPolicy = 'engine' | 'booked' | 'position_slot' | 'running_mean';
export const ETA_POLICIES: readonly EtaPolicy[] = ['engine', 'booked', 'position_slot', 'running_mean'];

/** How a patient with tests in several lab lines picks the next line. */
export type RoutePolicy = 'engine' | 'fixed' | 'random' | 'shortest_line';
export const ROUTE_POLICIES: readonly RoutePolicy[] = ['engine', 'fixed', 'random', 'shortest_line'];

/**
 * engine: suggestRoute on expected waits. fixed: must-go-first, then the hospital's line order.
 * random: any remaining line. shortest_line: fewest people standing in line (what a patient sees).
 */
export function chooseNextLine(
  policy: RoutePolicy, pending: { lineId: string; mustFirst: boolean }[], waits: Record<string, number>,
  queuedNow: Record<string, number>, lineOrder: readonly string[], rng: Rng,
): string {
  const ids = [...new Set(pending.map((x) => x.lineId))].sort((a, b) => lineOrder.indexOf(a) - lineOrder.indexOf(b));
  const first = new Set(pending.filter((x) => x.mustFirst).map((x) => x.lineId));
  switch (policy) {
    case 'engine': return suggestRoute(pending, waits)[0];
    case 'fixed': return [...ids].sort((a, b) => Number(first.has(b)) - Number(first.has(a)))[0];
    case 'random': return rng.pick(ids);
    case 'shortest_line': return [...ids].sort((a, b) => (queuedNow[a] ?? 0) - (queuedNow[b] ?? 0))[0];
  }
}
