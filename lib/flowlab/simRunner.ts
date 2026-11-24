// Flow Lab simulator: runs the flowq hospital-day simulator for a scenario and summarises ETA accuracy per policy and
// lab-routing results, for the DSS rules and for the full engine. Pure TypeScript (runs in the browser), unit-tested.
// Mirrors packages/flowq/cli/bench.ts for the pooled metrics.
import {
  ETA_POLICIES, ROUTE_POLICIES, etaMetrics, journeyMinutes, parseScenario, percentile, simulateDay, waitMetrics,
  type EtaMetrics, type Prediction,
} from '@/packages/flowq/src';
import { FULL_PRESET_ROW } from './compare';

export const MAX_DAYS = 200;
export type EngineMode = 'dss' | 'full';
export interface SimOptions { raw: Record<string, unknown>; days: number; seed: number; onProgress?: (done: number, total: number) => void; signal?: { aborted: boolean } }

export interface EtaRow { policy: string; stage: 'doctor' | 'lab'; metrics: EtaMetrics }
export interface RouteRow { route: string; labWait: number | null; journeyMean: number | null; journeyP90: number | null; doctorWait: number | null }
export interface SimSummary {
  days: number; seed: number;
  eta: Record<EngineMode, EtaRow[]>;
  routing: RouteRow[];
}

/** Engine settings of the full engine in the simulator (same study values as the live comparison). */
export const FULL_ENGINE_DOCTOR = {
  sumWith: 'mean', expectArrivals: true, showP: FULL_PRESET_ROW.show_p, walkInPerHour: FULL_PRESET_ROW.walk_in_per_hour,
  latenessMeanMin: FULL_PRESET_ROW.lateness_mean_min, latenessSdMin: FULL_PRESET_ROW.lateness_sd_min,
  rangeMethod: 'normal_sum', rangeCoverage: FULL_PRESET_ROW.range_coverage, historyWindow: FULL_PRESET_ROW.history_window,
} as const;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function scenarioWith(raw: Record<string, unknown>, doctor: Record<string, unknown>) {
  const copy = JSON.parse(JSON.stringify(raw)) as Record<string, unknown> & { engine?: { doctor?: object; lab?: object } };
  copy.engine = { doctor: { ...(copy.engine?.doctor ?? {}), ...doctor }, lab: copy.engine?.lab ?? {} };
  return parseScenario(copy);
}

export async function runSimulation(opts: SimOptions): Promise<SimSummary> {
  const { raw, days, seed } = opts;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new Error(`days must be an integer from 1 to ${MAX_DAYS}`);
  const scDss = scenarioWith(raw, {});
  const scFull = scenarioWith(raw, FULL_ENGINE_DOCTOR);
  const preds: Record<EngineMode, Prediction[]> = { dss: [], full: [] };
  const routeAcc = ROUTE_POLICIES.map(() => ({ labWait: [] as number[], doctorWait: [] as number[], journeys: [] as number[] }));
  const total = days;
  for (let i = 0; i < days; i++) {
    if (opts.signal?.aborted) throw new Error('aborted');
    const s = seed + i;
    preds.dss.push(...simulateDay(scDss, s, { route: 'engine' }).predictions);
    const fullDay = simulateDay(scFull, s, { route: 'engine' });
    preds.full.push(...fullDay.predictions);
    ROUTE_POLICIES.forEach((route, k) => {
      const day = route === 'engine' ? fullDay : simulateDay(scFull, s, { route });
      for (const w of waitMetrics(day)) if (w.meanMin != null) (w.stage === 'lab' ? routeAcc[k].labWait : routeAcc[k].doctorWait).push(w.meanMin);
      routeAcc[k].journeys.push(...journeyMinutes(day));
    });
    opts.onProgress?.(i + 1, total);
    if (i % 4 === 3) await tick();
  }
  const etaRows = (mode: EngineMode): EtaRow[] => ETA_POLICIES.flatMap((policy) =>
    (['doctor', 'lab'] as const).flatMap((stage) => {
      const sel = preds[mode].filter((p) => p.policy === policy && p.stage === stage);
      return sel.length ? [{ policy, stage, metrics: etaMetrics(sel) }] : [];
    }));
  const routing: RouteRow[] = ROUTE_POLICIES.map((route, k) => {
    const js = [...routeAcc[k].journeys].sort((a, b) => a - b);
    return { route, labWait: avg(routeAcc[k].labWait), doctorWait: avg(routeAcc[k].doctorWait), journeyMean: avg(js), journeyP90: js.length ? percentile(js, 0.9) : null };
  });
  return { days, seed, eta: { dss: etaRows('dss'), full: etaRows('full') }, routing };
}
