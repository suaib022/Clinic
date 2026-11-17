import { suggestRoute } from '../lab/routing';
import type { Rng } from './rng';

/**
 * What each patient is told: the engine, or a simpler baseline.
 * booked: the booked slot time (doctor only; meaningless in a walk-in lab line).
 * position_slot: people ahead (+1 if someone is being served) x configured time (doctor slot / lab typical).
 * running_mean: same count x mean of today's finished visits (falls back to the configured time).
 * history_mean: same count x mean of the same history the engine sees, per person's visit type. Same information
 *   as the engine with a simpler rule, so a difference comes from the method, not from more data.
 */
export type EtaPolicy = 'engine' | 'booked' | 'position_slot' | 'running_mean' | 'history_mean';
export const ETA_POLICIES: readonly EtaPolicy[] = ['engine', 'booked', 'position_slot', 'running_mean', 'history_mean'];

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
