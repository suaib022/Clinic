// Hospital-day simulator: deterministic, physically possible, stages in order.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseScenario, simulateDay, type FlowEvent, type SimDay } from '../../packages/flowq/src';

const RAW = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/default.json'), 'utf8'));
const SC = parseScenario(RAW);
const ref = (e: FlowEvent, type: string) => e.objects.find((o) => o.type === type)?.id;
const intervals = (day: SimDay, startAct: string, endAct: string, server: string, item: string) => {
  const open = new Map<string, number>(); const out: Record<string, [number, number][]> = {};
  for (const e of day.events) {
    const s = ref(e, server)!, k = ref(e, item)!;
    if (e.activity === startAct) open.set(k, e.time);
    if (e.activity === endAct && open.has(k)) (out[s] ??= []).push([open.get(k)!, e.time]);
  }
  return out;
};
const overlaps = (xs: [number, number][]) => [...xs].sort((a, b) => a[0] - b[0]).some((x, i, a) => i > 0 && x[0] < a[i - 1][1]);

describe('simulateDay', () => {
  const day = simulateDay(SC, 7, { route: 'engine' });

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(simulateDay(SC, 7, { route: 'engine' }))).toBe(JSON.stringify(day));
  });

  it('produces doctor and lab activity', () => {
    const acts = new Set(day.events.map((e) => e.activity));
    for (const a of ['session_start', 'check_in', 'consult_start', 'consult_end', 'lab_queue', 'sample_collected', 'report_ready', 'session_end']) {
      expect(acts.has(a as FlowEvent['activity'])).toBe(true);
    }
  });

  it('a doctor never sees two patients at once', () => {
    for (const xs of Object.values(intervals(day, 'consult_start', 'consult_end', 'doctor', 'appointment'))) expect(overlaps(xs)).toBe(false);
  });

  it('a lab counter never serves two patients at once', () => {
    for (const xs of Object.values(intervals(day, 'lab_call', 'sample_collected', 'lab_line', 'lab_queue_item'))) expect(overlaps(xs)).toBe(false);
  });

  it('lab stages are in order for every item', () => {
    const t: Record<string, Record<string, number>> = {};
    for (const e of day.events) {
      const q = ref(e, 'lab_queue_item');
      if (q) (t[q] ??= {})[e.activity] = e.time;
    }
    for (const x of Object.values(t)) {
      expect(x.lab_queue).toBeLessThanOrEqual(x.lab_call);
      expect(x.lab_call).toBeLessThanOrEqual(x.sample_collected);
    }
  });

  it('every report review follows a report of the same patient', () => {
    const ready = new Map<string, number>();
    for (const e of day.events) {
      const pid = ref(e, 'patient')!;
      if (e.activity === 'report_ready') ready.set(pid, Math.max(ready.get(pid) ?? 0, e.time));
      if (e.activity === 'return_queue') expect(ready.get(pid)).toBeLessThanOrEqual(e.time);
    }
  });

  it('every prediction with a start has a finite time', () => {
    for (const p of day.predictions) {
      expect(Number.isFinite(p.predictedAt)).toBe(true);
      if (p.actualStartAt != null) expect(Number.isFinite(p.actualStartAt)).toBe(true);
    }
  });

  it('a day where nobody comes does not throw', () => {
    const empty = parseScenario({ ...RAW, patients: { ...RAW.patients, noShowP: 1, walkInPerHour: 0 }, lab: { ...RAW.lab, outsidePerHour: 0 } });
    const d = simulateDay(empty, 1, { route: 'engine' });
    expect(d.events.some((e) => e.activity === 'consult_start')).toBe(false);
    expect(d.events.filter((e) => e.activity === 'no_show').length).toBeGreaterThan(0);
  });

  it('route policies run', () => {
    for (const route of ['fixed', 'random', 'shortest_line'] as const) expect(simulateDay(SC, 3, { route }).events.length).toBeGreaterThan(50);
  });
});

describe('lab predictions', () => {
  it('engine lab ETA looks at the line (not always "now") on a busy day', () => {
    const RAWB = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/busy-lab.json'), 'utf8'));
    const d = simulateDay(parseScenario(RAWB), 5, { route: 'engine' });
    const lab = d.predictions.filter((p) => p.policy === 'engine' && p.stage === 'lab');
    expect(lab.some((p) => p.predictedAt > p.madeAt)).toBe(true);
  });
});

describe('lab closing time', () => {
  it('everyone who joined a lab line is called, even past closing', () => {
    const RAWB = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/busy-lab.json'), 'utf8'));
    const d = simulateDay(parseScenario(RAWB), 1, { route: 'engine' });
    const q = d.events.filter((e) => e.activity === 'lab_queue').length;
    expect(d.events.filter((e) => e.activity === 'lab_call').length).toBe(q);
  });
});

describe('baselines', () => {
  const d = simulateDay(SC, 11, { route: 'engine' });
  const policies = (stage: string) => new Set(d.predictions.filter((p) => p.stage === stage).map((p) => p.policy));
  it('lab has no "booked" baseline (it would always say "now")', () => expect(policies('lab').has('booked')).toBe(false));
  it('both stages have the same-information baseline history_mean', () => {
    expect(policies('doctor').has('history_mean')).toBe(true);
    expect(policies('lab').has('history_mean')).toBe(true);
  });
});
