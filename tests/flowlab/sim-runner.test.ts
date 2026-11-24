import { describe, it, expect } from 'vitest';
import { runSimulation, MAX_DAYS } from '@/lib/flowlab/simRunner';
import { SCENARIOS, scenarioSources } from '@/lib/flowlab/scenarios';

const get = (s: Awaited<ReturnType<typeof runSimulation>>, mode: 'dss' | 'full', policy: string) =>
  s.eta[mode].find((r) => r.policy === policy && r.stage === 'doctor')!.metrics;

describe('flow lab simulator', () => {
  it('runs every shipped scenario and returns finite ETA metrics and routing rows', async () => {
    for (const sc of SCENARIOS) {
      const s = await runSimulation({ raw: sc.raw, days: 3, seed: 1 });
      const m = get(s, 'full', 'engine');
      expect(m.n, sc.id).toBeGreaterThan(0);
      expect(Number.isFinite(m.mae), sc.id).toBe(true);
      expect(s.routing.length).toBeGreaterThanOrEqual(2);
      expect(s.routing.every((r) => r.journeyMean == null || Number.isFinite(r.journeyMean))).toBe(true);
    }
  });
  it('is deterministic for the same seed and differs for another', async () => {
    const raw = SCENARIOS[0].raw;
    const a = await runSimulation({ raw, days: 4, seed: 7 });
    const b = await runSimulation({ raw, days: 4, seed: 7 });
    const c = await runSimulation({ raw, days: 4, seed: 99 });
    expect(get(b, 'full', 'engine').mae).toBe(get(a, 'full', 'engine').mae);
    expect(get(c, 'full', 'engine').mae).not.toBe(get(a, 'full', 'engine').mae);
  });
  it('the full engine gives a range with coverage; the DSS rules and baselines give a point estimate', async () => {
    const s = await runSimulation({ raw: SCENARIOS[0].raw, days: 5, seed: 1 });
    expect(get(s, 'full', 'engine').coverage).not.toBeNull();
    expect(get(s, 'full', 'booked').coverage ?? null).toBeNull();
  });
  it('does not change the scenario object it is given', async () => {
    const raw = SCENARIOS[0].raw; const before = JSON.stringify(raw);
    await runSimulation({ raw, days: 2, seed: 1 });
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('rejects bad day counts and can be aborted', async () => {
    await expect(runSimulation({ raw: SCENARIOS[1].raw, days: 0, seed: 1 })).rejects.toThrow();
    await expect(runSimulation({ raw: SCENARIOS[1].raw, days: MAX_DAYS + 1, seed: 1 })).rejects.toThrow();
    await expect(runSimulation({ raw: SCENARIOS[1].raw, days: 5, seed: 1, signal: { aborted: true } })).rejects.toThrow('aborted');
  });
  it('lists provenance for every scenario, with the cited / derived / assumption tags', () => {
    for (const sc of SCENARIOS) {
      const src = scenarioSources(sc.raw);
      expect(src.length, sc.id).toBeGreaterThan(0);
      expect(src.some((x) => x.kind !== 'other'), sc.id).toBe(true);
    }
  });
});
