// Benchmark: every ETA policy x every lab-routing policy over many simulated days.
// Usage: npm run flowq:bench -- [--scenario file.json] [--days 500] [--seed 1] [--out out/bench]
//          [--engine-doctor '{"sumWith":"mean"}'] [--engine-lab '{...}']   (engine settings for this run)
// Writes per_day.csv (one row per day x policy x stage x metric, for the statistics in analysis/),
// metrics.csv (pooled over all days), summary.json, and the first engine day as OCEL 2.0 and XES.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ETA_POLICIES, ROUTE_POLICIES, etaMetrics, journeyMinutes, parseScenario, percentile, simulateDay, toOcelJson, toXes, waitMetrics,
  type EtaMetrics, type Prediction,
} from '../src';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const scenarioPath = arg('scenario', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scenarios/default.json'));
const days = Number(arg('days', '500'));
const seed0 = Number(arg('seed', '1'));
const outDir = arg('out', 'out/bench');
if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer');

const raw = JSON.parse(readFileSync(scenarioPath, 'utf8'));
raw.engine = {
  doctor: { ...(raw.engine?.doctor ?? {}), ...JSON.parse(arg('engine-doctor', '{}')) },
  lab: { ...(raw.engine?.lab ?? {}), ...JSON.parse(arg('engine-lab', '{}')) },
};
const sc = parseScenario(raw);
mkdirSync(outDir, { recursive: true });

const ETA_KEYS: (keyof EtaMetrics)[] = ['n', 'mae', 'medianAe', 'p90Ae', 'within5', 'within10', 'coverage'];
const STAGES = ['doctor', 'lab'] as const;
type Row = { route: string; policy: string; stage: string; metric: string; value: number | null };
const pooled: Row[] = [];
const perDay: string[] = ['route,seed,policy,stage,metric,value'];
const fmt = (v: number | null) => (v == null || !Number.isFinite(v) ? '' : String(Math.round(v * 10000) / 10000));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

for (const route of ROUTE_POLICIES) {
  const preds: Prediction[] = [];
  const waits: Record<'doctor' | 'lab', number[]> = { doctor: [], lab: [] };
  const journeys: number[] = [];
  const docIdle: number[] = [], lineIdle: number[] = [];
  for (let s = seed0; s < seed0 + days; s++) {
    const day = simulateDay(sc, s, { route });
    if (route === 'engine') {
      preds.push(...day.predictions);
      for (const policy of ETA_POLICIES) {
        for (const stage of STAGES) {
          const sel = day.predictions.filter((p) => p.policy === policy && p.stage === stage);
          if (!sel.length) continue;
          const m = etaMetrics(sel);
          for (const k of ETA_KEYS) perDay.push(`${route},${s},${policy},${stage},${k},${fmt(m[k])}`);
        }
      }
    }
    const dayJourneys = journeyMinutes(day);
    for (const w of waitMetrics(day)) {
      if (w.meanMin != null) waits[w.stage].push(w.meanMin);
      perDay.push(`${route},${s},,${w.stage},mean_wait_min,${fmt(w.meanMin)}`);
    }
    perDay.push(`${route},${s},,journey,mean_min,${fmt(avg(dayJourneys))}`);
    journeys.push(...dayJourneys);
    docIdle.push(...Object.values(day.stats.doctorIdleMin));
    lineIdle.push(...Object.values(day.stats.lineIdleMin));
    if (s === seed0 && route === 'engine') {
      writeFileSync(path.join(outDir, `events-seed${s}.ocel.json`), JSON.stringify(toOcelJson(day.events), null, 1));
      writeFileSync(path.join(outDir, `events-seed${s}.xes`), toXes(day.events));
    }
  }
  if (route === 'engine') {
    for (const policy of ETA_POLICIES) {
      for (const stage of STAGES) {
        const sel = preds.filter((p) => p.policy === policy && p.stage === stage);
        if (!sel.length) continue;
        const m = etaMetrics(sel);
        for (const k of ETA_KEYS) pooled.push({ route, policy, stage, metric: k, value: m[k] });
      }
    }
  }
  const js = [...journeys].sort((a, b) => a - b);
  pooled.push(
    { route, policy: '', stage: 'doctor', metric: 'mean_wait_min', value: avg(waits.doctor) },
    { route, policy: '', stage: 'lab', metric: 'mean_wait_min', value: avg(waits.lab) },
    { route, policy: '', stage: 'journey', metric: 'mean_min', value: avg(js) },
    { route, policy: '', stage: 'journey', metric: 'p90_min', value: js.length ? percentile(js, 0.9) : null },
    { route, policy: '', stage: 'doctor', metric: 'idle_min_per_session', value: avg(docIdle) },
    { route, policy: '', stage: 'lab', metric: 'idle_min_per_line_day', value: avg(lineIdle) },
  );
}

writeFileSync(path.join(outDir, 'per_day.csv'), perDay.join('\n') + '\n');
writeFileSync(path.join(outDir, 'metrics.csv'), ['route,policy,stage,metric,value', ...pooled.map((r) => `${r.route},${r.policy},${r.stage},${r.metric},${fmt(r.value)}`)].join('\n') + '\n');
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ scenario: scenarioPath, engine: sc.engine, days, seed: seed0, rows: pooled }, null, 2));

const g = (route: string, policy: string, stage: string, metric: string) =>
  fmt(pooled.find((r) => r.route === route && r.policy === policy && r.stage === stage && r.metric === metric)?.value ?? null);
console.log(`flowq bench: ${days} days x ${ROUTE_POLICIES.length} routing policies -> ${outDir}`);
console.log('\nETA accuracy (routing = engine, pooled over days):');
console.table(ETA_POLICIES.flatMap((policy) => STAGES.filter((stage) => g('engine', policy, stage, 'n') !== '').map((stage) => ({
  policy, stage, n: g('engine', policy, stage, 'n'), mae: g('engine', policy, stage, 'mae'), median: g('engine', policy, stage, 'medianAe'),
  p90: g('engine', policy, stage, 'p90Ae'), within5: g('engine', policy, stage, 'within5'), within10: g('engine', policy, stage, 'within10'),
  coverage: g('engine', policy, stage, 'coverage'),
}))));
console.log('Lab routing:');
console.table(ROUTE_POLICIES.map((route) => ({
  route, lab_wait: g(route, '', 'lab', 'mean_wait_min'), journey_mean: g(route, '', 'journey', 'mean_min'),
  journey_p90: g(route, '', 'journey', 'p90_min'), doctor_wait: g(route, '', 'doctor', 'mean_wait_min'),
})));
