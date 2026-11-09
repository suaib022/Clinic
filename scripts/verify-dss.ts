/**
 * DSS verification gate (part of `npm run verify`). Fails loudly on the first broken step.
 *   1. typecheck (whole project)
 *   2. eslint on every file this branch adds or changes
 *   3. vitest: engine + component tests, DB access-rule tests, simulated clinic day
 *   4. engine day simulation (estimate accuracy guard)
 *   5. next build, then the HTTP endpoint tests against `next start`
 * Flags: --skip-build (no build, no HTTP tests), --skip-db (engine/ui tests only, no database needed).
 * DSS_BASE_URL=http://localhost:3000 reuses a running server for the HTTP tests instead of `next start`.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const env = { ...process.env, DSS_DEV_SEED: process.env.DSS_DEV_SEED ?? '1' };

// Large legacy files that DSS only touches lightly keep their pre-existing lint debt (listed explicitly).
const LEGACY_LINT_DEBT = new Set<string>([
  'components/queue/PatientLiveQueueCard.tsx', // replaced in DSS-M6
  'app/compounder/dashboard/page.tsx', // DSS changed one link; 3 pre-existing lint errors
]);
const git = (a: string[]) => (spawnSync('git', a, { encoding: 'utf8' }).stdout ?? '').split('\n').filter(Boolean);
const DSS_PATHS = [...new Set([
  ...git(['diff', '--name-only', '--diff-filter=d', 'main', '--', '*.ts', '*.tsx']),
  ...git(['ls-files', '--others', '--exclude-standard', '--', '*.ts', '*.tsx']),
])].filter((p) => fs.existsSync(p) && !LEGACY_LINT_DEBT.has(p));

function run(name: string, cmd: string[], extraEnv: Record<string, string> = {}) {
  const started = Date.now();
  console.log(`\n▶ ${name}: ${cmd.join(' ')}`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`\n✖ DSS VERIFY FAILED at "${name}" (exit ${r.status}).`);
    process.exit(1);
  }
  console.log(`✔ ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`server at ${url} did not start`);
}

async function main() {
  run('Typecheck', ['npx', 'tsc', '--noEmit']);
  run('Lint (DSS files)', ['npx', 'eslint', '--max-warnings=0', ...DSS_PATHS]);
  run('Tests', ['npx', 'vitest', 'run', ...(args.has('--skip-db') ? ['tests/dss/engine', 'tests/dss/ui'] : [])]);
  run('Engine day simulation', ['npx', 'tsx', 'scripts/dss-simulate.ts']);
  if (args.has('--skip-build')) return console.log('\n✔ DSS verify passed (build and HTTP tests skipped).');

  run('Build', ['npm', 'run', 'build']);
  if (args.has('--skip-db')) return console.log('\n✔ DSS verify passed (HTTP tests skipped).');
  let base = process.env.DSS_BASE_URL;
  let server: ReturnType<typeof spawn> | null = null;
  if (!base) {
    base = 'http://localhost:3105';
    server = spawn('npx', ['next', 'start', '-p', '3105'], { env, stdio: 'ignore', detached: true });
    await waitFor(base, 60_000);
  }
  try {
    run('HTTP endpoint tests', ['npx', 'vitest', 'run', 'tests/dss/api'], { DSS_BASE_URL: base });
  } finally {
    if (server?.pid) process.kill(-server.pid);
  }
  console.log('\n✔ DSS verify passed.');
}

main().catch((e) => {
  console.error('\n✖ DSS VERIFY FAILED:', e);
  process.exit(1);
});
