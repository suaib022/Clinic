import { describe, it, expect } from 'vitest';
import { etaMetrics, MIN, type Prediction } from '../../packages/flowq/src';

const p = (pred: number, actual: number | null, low: number | null = null, high: number | null = null): Prediction => ({
  visitId: 'v', policy: 'engine', stage: 'doctor', serverId: 'd', madeAt: 0, predictedAt: pred * MIN, low: low == null ? null : low * MIN,
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
  it('empty input gives nulls, not NaN', () => expect(etaMetrics([])).toEqual({ n: 0, mae: null, medianAe: null, coverage: null }));
});
