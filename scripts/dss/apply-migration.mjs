// Apply one migration file to the linked Supabase DB and record it in supabase_migrations.schema_migrations
// (what `supabase db push` would do). Usage: node scripts/dss/apply-migration.mjs supabase/migrations/<file>.sql
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { connectionString } from './db.mjs';

const file = process.argv[2];
const [, version, name] = path.basename(file).match(/^(\d+)_(.+)\.sql$/) ?? [];
if (!version) throw new Error(`Not a migration file name: ${file}`);
const sql = fs.readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, ARRAY[$3])
     ON CONFLICT (version) DO UPDATE SET statements = EXCLUDED.statements`,
    [version, name, sql]
  );
  await client.query('COMMIT');
  console.log(`applied ${version}_${name}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('FAILED:', e.message, e.where ?? '');
  process.exitCode = 1;
} finally {
  await client.end();
}
