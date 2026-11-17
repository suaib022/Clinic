// Sensitivity / scenario sweep: change one scenario parameter over a list of values and compare policies at each value.
//
// npm run flowq:sweep -- --param lab.outsidePerHour --values '6;20;40;60' --what routing --days 200 --out out/sweep/load
//   --param    dot path into the scenario; '*' maps over an array (e.g. lab.lines.*.turnaroundMin)
//   --values   ';'-separated JSON values (e.g. '[1,1];[1,3];[2,4]' for lab.testsPerOrder)
//   --what     routing (route policies) | returns (same-day return policies) | eta (ETA policies) | all
//   [--scenario file.json] [--seed 1] [--engine-doctor '{...}'] [--engine-lab '{...}']
// Writes per_day.csv: param,value,kind,policy,seed,stage,metric,metric_value (one row per day; days are the unit of analysis).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ETA_POLICIES, RETURN_POLICIES, ROUTE_POLICIES, etaMetrics, journeyMinutes, parseScenario, simulateDay, waitMetrics,
  type EtaMetrics, type SimDay,
} from '../src';

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : fallback;
};
const scenarioPath = arg('scenario', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scenarios/default.json'))!;
const param = arg('param');
const valuesRaw = arg('values');
const what = arg('what', 'all')!;
const days = Number(arg('days', '200'));
const seed0 = Number(arg('seed', '1'));
const outDir = arg('out', 'out/sweep')!;
if (!param || !valuesRaw) throw new Error('--param and --values are required');
if (!['routing', 'returns', 'eta', 'all'].includes(what)) throw new Error('--what must be routing, returns, eta or all');
if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer');
const values: unknown[] = valuesRaw.split(';').map((v) => JSON.parse(v));

/** Sets `value` at a dot path; '*' applies the rest of the path to every array element. Throws on a missing key. */
export function setPath(obj: unknown, parts: string[], value: unknown, full = parts.join('.')): void {
  const [head, ...rest] = parts;
  if (obj == null || typeof obj !== 'object') throw new Error(`--param ${full}: no such path`);
  if (head === '*') {
    if (!Array.isArray(obj)) throw new Error(`--param ${full}: '*' needs an array`);
    for (const x of obj) setPath(x, rest, value, full);
    return;
  }
  const o = obj as Record<string, unknown>;
  if (!(head in o)) throw new Error(`--param ${full}: '${head}' not found`);
  if (rest.length === 0) o[head] = value;
  else setPath(o[head], rest, value, full);
}

const base = JSON.parse(readFileSync(scenarioPath, 'utf8'));
base.engine = {
  doctor: { ...(base.engine?.doctor ?? {}), ...JSON.parse(arg('engine-doctor', '{}')!) },
  lab: { ...(base.engine?.lab ?? {}), ...JSON.parse(arg('engine-lab', '{}')!) },
};
mkdirSync(outDir, { recursive: true });
const rows: string[] = ['param,value,kind,policy,seed,stage,metric,metric_value'];
const fmt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '' : String(Math.round(v * 10000) / 10000));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const ETA_KEYS: (keyof EtaMetrics)[] = ['mae', 'medianAe', 'p90Ae', 'within5', 'within10', 'coverage'];

function flowRows(v: string, kind: string, policy: string, s: number, day: SimDay) {
  for (const w of waitMetrics(day)) rows.push(`${param},${v},${kind},${policy},${s},${w.stage},mean_wait_min,${fmt(w.meanMin)}`);
  rows.push(`${param},${v},${kind},${policy},${s},journey,mean_min,${fmt(avg(journeyMinutes(day)))}`);
  rows.push(`${param},${v},${kind},${policy},${s},doctor,overtime_min,${fmt(sum(day.stats.doctorOvertimeMin))}`);
}

for (const value of values) {
  const raw = JSON.parse(JSON.stringify(base));
  setPath(raw, param.split('.'), value);
  const sc = parseScenario(raw);
  const v = JSON.stringify(value).replace(/,/g, ' ');
  for (let s = seed0; s < seed0 + days; s++) {
    if (what === 'routing' || what === 'all') {
      for (const route of ROUTE_POLICIES) flowRows(v, 'routing', route, s, simulateDay(sc, s, { route }));
    }
    if (what === 'returns' || what === 'all') {
      for (const ret of RETURN_POLICIES) {
        const day = simulateDay(sc, s, { route: 'engine', returns: ret });
        flowRows(v, 'returns', ret, s, day);
        for (const [k, x] of Object.entries(day.stats.returns)) rows.push(`${param},${v},returns,${ret},${s},returns,${k},${x}`);
      }
    }
    if (what === 'eta' || what === 'all') {
      const day = simulateDay(sc, s, { route: 'engine' });
      for (const policy of ETA_POLICIES) {
        for (const stage of ['doctor', 'lab'] as const) {
          const sel = day.predictions.filter((p) => p.policy === policy && p.stage === stage);
          if (!sel.length) continue;
          const m = etaMetrics(sel);
          for (const k of ETA_KEYS) rows.push(`${param},${v},eta,${policy},${s},${stage},${k},${fmt(m[k])}`);
        }
      }
    }
  }
  console.log(`${param} = ${JSON.stringify(value)}: ${days} days done`);
}
writeFileSync(path.join(outDir, 'per_day.csv'), rows.join('\n') + '\n');
writeFileSync(path.join(outDir, 'sweep.json'), JSON.stringify({ scenario: scenarioPath, param, values, what, days, seed: seed0, engine: base.engine }, null, 2));
console.log(`-> ${path.join(outDir, 'per_day.csv')} (${rows.length - 1} rows)`);
