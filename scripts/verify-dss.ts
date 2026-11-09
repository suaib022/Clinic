/**
 * DSS verification gate (part of `npm run verify`). Fails loudly on the first broken step.
 *   1. typecheck (whole project)
 *   2. eslint on DSS files (the rest of the repo has pre-existing lint debt, see docs/dss-audit.md)
 *   3. vitest: engine unit tests, component tests, access-rule tests and the simulated clinic day
 *   4. next build
 * Flags: --skip-build, --skip-db (engine/ui tests only, no database needed).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));

// Lint every TS/TSX file this branch adds or changes (vs main). Large legacy files that DSS only touches
// lightly keep their pre-existing lint debt and are listed here explicitly.
const LEGACY_LINT_DEBT = new Set<string>([]);
const git = (a: string[]) => (spawnSync('git', a, { encoding: 'utf8' }).stdout ?? '').split('\n').filter(Boolean);
const DSS_PATHS = [...new Set([
  ...git(['diff', '--name-only', '--diff-filter=d', 'main', '--', '*.ts', '*.tsx']),
  ...git(['ls-files', '--others', '--exclude-standard', '--', '*.ts', '*.tsx']),
])].filter((p) => fs.existsSync(p) && !LEGACY_LINT_DEBT.has(p));

const steps: Array<[string, string[]]> = [
  ['Typecheck', ['npx', 'tsc', '--noEmit']],
  ['Lint (DSS files)', ['npx', 'eslint', '--max-warnings=0', ...DSS_PATHS]],
  ['Tests', ['npx', 'vitest', 'run', ...(args.has('--skip-db') ? ['tests/dss/engine', 'tests/dss/ui'] : [])]],
  ['Engine day simulation', ['npx', 'tsx', 'scripts/dss-simulate.ts']],
];
if (!args.has('--skip-build')) steps.push(['Build', ['npm', 'run', 'build']]);

for (const [name, cmd] of steps) {
  const started = Date.now();
  console.log(`\n▶ ${name}: ${cmd.join(' ')}`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, DSS_DEV_SEED: process.env.DSS_DEV_SEED ?? '1' } });
  if (r.status !== 0) {
    console.error(`\n✖ DSS VERIFY FAILED at "${name}" (exit ${r.status}).`);
    process.exit(1);
  }
  console.log(`✔ ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
}
console.log('\n✔ DSS verify passed.');
