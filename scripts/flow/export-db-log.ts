// Read-only export of the web app's queue log to OCEL 2.0 and XES. Never writes to the database.
// Usage: npx tsx scripts/flow/export-db-log.ts --from 2026-11-01 --to 2026-11-30 [--out out/db-log]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { mapQueueEvents, type ApptRow, type QueueEventRow } from '../../lib/flow/dbLog';
import { toOcelJson, toXes } from '../../packages/flowq/src';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const arg = (n: string, f?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : f; };
const from = arg('from'), to = arg('to'), out = arg('out', 'out/db-log')!;
if (!from || !to) throw new Error('--from and --to (yyyy-mm-dd) are required');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function all<T>(q: (fromRow: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
const events = await all<QueueEventRow>((i) => db.from('queue_events')
  .select('id, appointment_id, doctor_id, event_type, actor_role, occurred_at, session_id, request_key, metadata')
  .gte('occurred_at', `${from}T00:00:00+06:00`).lte('occurred_at', `${to}T23:59:59+06:00`).order('occurred_at').range(i, i + 999));
const ids = [...new Set(events.map((e) => e.appointment_id).filter((x): x is string => !!x))];
const appts: ApptRow[] = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from('appointments').select('id, patient_id, created_at').in('id', ids.slice(i, i + 200));
  if (error) throw error;
  appts.push(...(data ?? []).map((a: { id: string; patient_id: string; created_at: string | null }) => ({ id: a.id, patient_id: a.patient_id, booked_at: a.created_at })));
}
const flow = mapQueueEvents(events, appts);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, `queue-${from}_${to}.ocel.json`), JSON.stringify(toOcelJson(flow), null, 1));
writeFileSync(path.join(out, `queue-${from}_${to}.xes`), toXes(flow));
console.log(`${events.length} queue_events rows -> ${flow.length} log events (${appts.length} appointments) in ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
