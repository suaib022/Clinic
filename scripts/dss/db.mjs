// Dev helper: run SQL against the linked Supabase Postgres.
// Usage: node scripts/dss/db.mjs -c "select 1"   |   node scripts/dss/db.mjs path/to/file.sql
// Needs db_pass (or DATABASE_URL) in .env.local and supabase/.temp/pooler-url from `supabase link`.
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

export function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const pooler = fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
  const pass = encodeURIComponent(process.env.db_pass ?? '');
  return pooler.replace('@', `:${pass}@`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  const sql = arg === '-c' ? process.argv[3] : fs.readFileSync(arg, 'utf8');
  const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const r of results) for (const row of r.rows ?? []) console.log(Object.values(row).map(v => typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)).join(" | "));
    console.log('OK');
  } catch (e) {
    console.error('SQL ERROR:', e.message, e.detail ?? '', e.where ?? '');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
