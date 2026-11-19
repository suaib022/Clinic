import { describe, it, expect } from 'vitest';
import { etaMetrics, MIN, type Prediction } from '../../packages/flowq/src';

const p = (pred: number, actual: number | null, low: number | null = null, high: number | null = null): Prediction => ({
  visitId: 'v', policy: 'engine', stage: 'doctor', serverId: 'd', madeAt: 0, ahead: 0, predictedAt: pred * MIN, low: low == null ? null : low * MIN,
  high: high == null ? null : high * MIN, actualStartAt: actual == null ? null : actual * MIN,
});

describe('etaMetrics', () => {
  it('mean and median absolute error', () => {
    expect(etaMetrics([p(10, 10), p(10, 20), p(30, 10)])).toMatchObject({ n: 3, mae: 10, medianAe: 10 });
  });
  it('coverage counts real starts inside the range', () => {
    expect(etaMetrics([p(0, 5, 0, 10), p(0, 15, 0, 10), p(0, 0, 0, 10), p(0, 11, 0, 10)]).coverage).toBe(0.5);
  });
  it('predictions without a real start are ignored', () => expect(etaMetrics([p(0, null), p(5, 5)]).n).toBe(1));
  it('empty input gives nulls, not NaN', () => expect(etaMetrics([])).toEqual({ n: 0, mae: null, medianAe: null, p90Ae: null, within5: null, within10: null, coverage: null }));
});

describe('etaMetrics patient-facing measures', () => {
  it('share within 5 and 10 minutes, and p90 error', () => {
    const m = etaMetrics([p(0, 0), p(0, 4), p(0, 8), p(0, 20)]);
    expect(m.within5).toBe(0.5);
    expect(m.within10).toBe(0.75);
    expect(m.p90Ae).toBeCloseTo(16.4, 5); // linear interpolation between 8 and 20
  });
});

describe('labVisitMinutes', () => {
  it('first lab_queue to last sample_collected per patient', async () => {
    const { labVisitMinutes } = await import('../../packages/flowq/src');
    const ev = (activity: string, min: number, pid: string) => ({ id: `${pid}${min}`, activity, time: min * MIN, objects: [{ type: 'patient', id: pid }], attrs: {} });
    const day = { predictions: [], stats: {}, events: [ev('lab_queue', 0, 'p1'), ev('sample_collected', 5, 'p1'), ev('lab_queue', 5, 'p1'), ev('sample_collected', 12, 'p1'), ev('report_ready', 90, 'p1'), ev('lab_queue', 3, 'p2')] };
    expect(labVisitMinutes(day as never)).toEqual([12]);
  });
});

describe('etaByHorizon', () => {
  it('splits by people ahead at prediction time', async () => {
    const { etaByHorizon } = await import('../../packages/flowq/src');
    const q = (ahead: number, pred: number, actual: number) => ({ ...p(pred, actual), ahead });
    const h = etaByHorizon([q(1, 5, 10), q(5, 40, 50), q(9, 30, 70)]);
    expect(h.a0_1).toMatchObject({ n: 1, mae: 5 });
    expect(h.a4_6).toMatchObject({ n: 1, mae: 10 });
    expect(h.a7plus).toMatchObject({ n: 1, mae: 40 });
    expect(h.a2_3.n).toBe(0);
  });
});
