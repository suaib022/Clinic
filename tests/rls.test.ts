import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize anonymous client
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
  console.log("Running RLS Tests...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Unauthenticated users cannot read patients
  const { data: p1, error: e1 } = await anonClient.from('patients').select('*');
  console.log("patients data:", p1, "error:", e1);
  assert(e1 !== null || p1?.length === 0, 'Unauthenticated users cannot read patients table');

  // 2. Unauthenticated users cannot read appointments
  const { data: p2, error: e2 } = await anonClient.from('appointments').select('*');
  assert(e2 !== null || p2?.length === 0, 'Unauthenticated users cannot read appointments table');

  // 3. Unauthenticated users can read doctors
  const { data: p3, error: e3 } = await anonClient.from('doctors').select('id').limit(1);
  assert(e3 === null, 'Unauthenticated users can read doctors table');

  console.log(`\nTests Completed: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
      process.exit(1);
  }
}

runTests();
