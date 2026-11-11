import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

for (const t of ['record_extractions', 'rx_medications', 'clinical_notes', 'lab_results', 'report_insights']) {
  const r = await db.from(t).select('*', { count: 'exact', head: true });
  console.log(t, r.error ? 'ERROR ' + r.error.message : 'ok rows=' + r.count);
}
const patient = must(await db.from('patients').select('id').limit(1).single(), 'patient');
const rec = must(await db.from('medical_records').insert({
  patient_id: patient.id, record_type: 'prescription', title: 'TEST extraction cascade', file_path: 'test/none.pdf'
}).select('id, extraction_status').single(), 'insert record');
console.log('trigger sets status:', rec.extraction_status);
must(await db.from('rx_medications').insert({ record_id: rec.id, patient_id: patient.id, drug_name: 'TEST' }), 'insert med');
must(await db.from('lab_results').insert({ record_id: rec.id, patient_id: patient.id, analyte: 'TEST' }), 'insert lab');
must(await db.from('medical_records').delete().eq('id', rec.id), 'delete record');
const left = must(await db.from('rx_medications').select('id').eq('record_id', rec.id), 'check meds').length
  + must(await db.from('lab_results').select('id').eq('record_id', rec.id), 'check labs').length;
console.log('rows left after delete:', left);
