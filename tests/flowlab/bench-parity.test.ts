// The browser simulator must give the same numbers as the published CLI (flowq:bench) for the same scenario, seed and settings.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSimulation, FULL_ENGINE_DOCTOR } from '@/lib/flowlab/simRunner';
import { SCENARIOS } from '@/lib/flowlab/scenarios';

const DAYS = 12, SEED = 3;
const sc = SCENARIOS.find((s) => s.id === 'hospitalopd')!;
const bench = (engineDoctor: object) => {
  const out = mkdtempSync(path.join(tmpdir(), 'flowlab-parity-'));
  execFileSync('npx', ['tsx', 'packages/flowq/cli/bench.ts', '--scenario', 'packages/flowq/scenarios/hospitalopd.json', '--days', String(DAYS),
    '--seed', String(SEED), '--out', out, '--engine-doctor', JSON.stringify(engineDoctor)], { cwd: process.cwd(), stdio: 'pipe' });
  const rows = readFileSync(path.join(out, 'metrics.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const v = (route: string, policy: string, stage: string, metric: string) =>
    Number(rows.find((r) => r[0] === route && r[1] === policy && r[2] === stage && r[3] === metric)?.[4]);
  return v;
};

describe('browser simulator matches flowq:bench', () => {
  it('ETA metrics and journey times agree for both engine modes', async () => {
    const sim = await runSimulation({ raw: sc.raw, days: DAYS, seed: SEED });
    const dss = bench({});
    const full = bench(FULL_ENGINE_DOCTOR);
    for (const [mode, v] of [['dss', dss], ['full', full]] as const) {
      for (const policy of ['engine', 'booked', 'history_mean']) {
        const m = sim.eta[mode].find((r) => r.policy === policy && r.stage === 'doctor')!.metrics;
        expect(m.n).toBe(v('engine', policy, 'doctor', 'n'));
        expect(m.mae).toBeCloseTo(v('engine', policy, 'doctor', 'mae'), 3);
        expect(m.within5).toBeCloseTo(v('engine', policy, 'doctor', 'within5'), 3);
      }
    }
    expect(sim.eta.full.find((r) => r.policy === 'engine' && r.stage === 'doctor')!.metrics.coverage!).toBeCloseTo(full('engine', 'engine', 'doctor', 'coverage'), 3);
    for (const r of sim.routing) expect(r.journeyMean!).toBeCloseTo(full(r.route, '', 'journey', 'mean_min'), 2);
  }, 120_000);
});
