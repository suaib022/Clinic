// Dev-only: create/refresh the DSS test accounts. Run: npx tsx scripts/dss/seed-dev.ts [--reset]
import { seed, resetTestDoctors, closeDb, ACCOUNTS } from './testkit';

async function main() {
  const s = await seed();
  if (process.argv.includes('--reset')) await resetTestDoctors([s.users.doctorA, s.users.doctorB]);
  console.log('DSS test accounts ready (password: DSS_TEST_PASSWORD in .env.local):');
  for (const [k, a] of Object.entries(ACCOUNTS)) console.log(`  ${k.padEnd(9)} ${a.role.padEnd(10)} ${a.email}`);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
