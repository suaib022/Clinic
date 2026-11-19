// Regenerates the small OCEL / XES fixtures used by analysis/tests (one simulated day, 60 patients, frequent staff deviations).
// Run: npx tsx scripts/flow/make-analysis-fixtures.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parseScenario, simulateDay, toOcelJson, toXes } from '../../packages/flowq/src';
const raw = JSON.parse(readFileSync(new URL('../../packages/flowq/scenarios/default.json', import.meta.url), 'utf8'));
raw.staff = { ...raw.staff, awayWhenCalledP: 0.2, undoCallP: 0.1, priorityP: 0.1 };
raw.lab.lines = raw.lab.lines.map((l: { turnaroundMin: number }) => ({ ...l, turnaroundMin: l.turnaroundMin ? 20 : 0 }));
raw.returns.sameDayWillingP = 1;
const d = simulateDay(parseScenario(raw), 2, { route: 'engine' });
const patients = [...new Set(d.events.map((e) => e.objects.find((o) => o.type === 'patient')?.id).filter(Boolean))].slice(0, 60);
const keep = new Set(patients);
const ev = d.events.filter((e) => { const p = e.objects.find((o) => o.type === 'patient')?.id; return p ? keep.has(p) : false; });
writeFileSync(new URL('../../analysis/tests/fixtures/small.ocel.json', import.meta.url), JSON.stringify(toOcelJson(ev)));
writeFileSync(new URL('../../analysis/tests/fixtures/journeys.xes', import.meta.url), toXes(ev));
const acts: Record<string, number> = {}; for (const e of ev) acts[e.activity] = (acts[e.activity] ?? 0) + 1;
console.log(ev.length, JSON.stringify(acts));
