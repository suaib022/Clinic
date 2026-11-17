// Same-day report review policies.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseScenario, simulateDay } from '../../packages/flowq/src';

const RAW = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/default.json'), 'utf8'));
// Fast reports (30 min) and a willing patient so that same-day reviews actually happen.
const FAST = parseScenario({
  ...RAW, returns: { ...RAW.returns, sameDayWillingP: 1 },
  lab: { ...RAW.lab, lines: RAW.lab.lines.map((l: { turnaroundMin: number }) => ({ ...l, turnaroundMin: l.turnaroundMin ? 30 : 0 })) },
});
const sum = (k: 'eligible' | 'suggested' | 'attempted' | 'seen' | 'turnedAway', ret: 'advice' | 'always' | 'never') =>
  [1, 2, 3, 4, 5].reduce((m, s) => m + simulateDay(FAST, s, { route: 'engine', returns: ret }).stats.returns[k], 0);

describe('return policies', () => {
  it('never: nobody comes back the same day', () => {
    expect(sum('attempted', 'never')).toBe(0);
    expect(sum('eligible', 'never')).toBeGreaterThan(0);
  });
  it('advice: only suggested returns are attempted, and every attempt is seen or turned away', () => {
    for (const s of [1, 2, 3]) {
      const r = simulateDay(FAST, s, { route: 'engine', returns: 'advice' }).stats.returns;
      expect(r.attempted).toBeLessThanOrEqual(r.suggested);
      expect(r.seen + r.turnedAway).toBe(r.attempted);
    }
    expect(sum('attempted', 'advice')).toBeGreaterThan(0);
  });
  it('always tries at least as often as advice', () => {
    expect(sum('attempted', 'always')).toBeGreaterThanOrEqual(sum('attempted', 'advice'));
  });
  it('overtime is never negative', () => {
    for (const v of Object.values(simulateDay(FAST, 1, { route: 'engine', returns: 'always' }).stats.doctorOvertimeMin)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
