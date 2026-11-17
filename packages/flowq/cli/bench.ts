// Benchmark: every ETA policy x every lab-routing policy over many simulated days.
// Usage: npm run flowq:bench -- [--scenario file.json] [--days 500] [--seed 1] [--out out/bench]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ETA_POLICIES, ROUTE_POLICIES, etaMetrics, journeyMinutes, parseScenario, percentile, simulateDay, toOcelJson, toXes, waitMetrics,
  type Prediction,
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

const sc = parseScenario(JSON.parse(readFileSync(scenarioPath, 'utf8')));
mkdirSync(outDir, { recursive: true });

type Row = { route: string; eta: string; stage: string; metric: string; value: number | null };
const rows: Row[] = [];
const fmt = (v: number | null) => (v == null ? '' : String(Math.round(v * 1000) / 1000));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

for (const route of ROUTE_POLICIES) {
  const preds: Prediction[] = [];
  const waits: Record<'doctor' | 'lab', number[]> = { doctor: [], lab: [] };
  const journeys: number[] = [];
  const docIdle: number[] = [], lineIdle: number[] = [];
  for (let s = seed0; s < seed0 + days; s++) {
    const day = simulateDay(sc, s, { route });
    preds.push(...day.predictions);
    for (const w of waitMetrics(day)) if (w.meanMin != null) waits[w.stage].push(w.meanMin);
    journeys.push(...journeyMinutes(day));
    docIdle.push(...Object.values(day.stats.doctorIdleMin));
    lineIdle.push(...Object.values(day.stats.lineIdleMin));
    if (s === seed0 && route === 'engine') {
      writeFileSync(path.join(outDir, `events-seed${s}.ocel.json`), JSON.stringify(toOcelJson(day.events), null, 1));
      writeFileSync(path.join(outDir, `events-seed${s}.xes`), toXes(day.events));
    }
  }
  if (route === 'engine') {
    for (const eta of ETA_POLICIES) {
      for (const stage of ['doctor', 'lab'] as const) {
        const m = etaMetrics(preds.filter((p) => p.policy === eta && p.stage === stage));
        rows.push({ route, eta, stage, metric: 'n', value: m.n }, { route, eta, stage, metric: 'mae_min', value: m.mae },
          { route, eta, stage, metric: 'median_ae_min', value: m.medianAe }, { route, eta, stage, metric: 'coverage', value: m.coverage });
      }
    }
  }
  const js = [...journeys].sort((a, b) => a - b);
  rows.push(
    { route, eta: '', stage: 'doctor', metric: 'mean_wait_min', value: avg(waits.doctor) },
    { route, eta: '', stage: 'lab', metric: 'mean_wait_min', value: avg(waits.lab) },
    { route, eta: '', stage: 'journey', metric: 'mean_min', value: avg(js) },
    { route, eta: '', stage: 'journey', metric: 'p90_min', value: js.length ? percentile(js, 0.9) : null },
    { route, eta: '', stage: 'doctor', metric: 'idle_min_per_session', value: avg(docIdle) },
    { route, eta: '', stage: 'lab', metric: 'idle_min_per_line_day', value: avg(lineIdle) },
  );
}

writeFileSync(path.join(outDir, 'metrics.csv'), ['route,eta,stage,metric,value', ...rows.map((r) => `${r.route},${r.eta},${r.stage},${r.metric},${fmt(r.value)}`)].join('\n') + '\n');
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ scenario: scenarioPath, days, seed: seed0, rows }, null, 2));

console.log(`flowq bench: ${days} days x ${ROUTE_POLICIES.length} routing policies -> ${outDir}`);
console.log('\nETA accuracy (routing = engine):');
console.table(ETA_POLICIES.flatMap((eta) => (['doctor', 'lab'] as const).map((stage) => {
  const g = (metric: string) => fmt(rows.find((r) => r.route === 'engine' && r.eta === eta && r.stage === stage && r.metric === metric)?.value ?? null);
  return { eta, stage, n: g('n'), mae_min: g('mae_min'), median_ae_min: g('median_ae_min'), coverage: g('coverage') };
})));
console.log('Lab routing:');
console.table(ROUTE_POLICIES.map((route) => {
  const g = (stage: string, metric: string) => fmt(rows.find((r) => r.route === route && r.stage === stage && r.metric === metric)?.value ?? null);
  return { route, lab_wait: g('lab', 'mean_wait_min'), journey_mean: g('journey', 'mean_min'), journey_p90: g('journey', 'p90_min'), doctor_wait: g('doctor', 'mean_wait_min') };
}));
