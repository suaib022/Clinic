// Uploads the two synthetic test documents for one patient (by UHID) as if the patient uploaded them,
// and runs extraction. Rows are kept so the UI can be checked; delete them from the page afterwards.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/seed_profile_docs.mts <UHID>
import { readFileSync } from 'node:fs';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processRecord } from '@/lib/extraction/processRecord';

const uhid = process.argv[2];
const { data: patient } = await db.from('patients').select('id, auth_user_id').eq('uhid', uhid).single();
if (!patient?.auth_user_id) throw new Error(`No patient with login for ${uhid}`);

for (const [file, type, title] of [
    ['scratch/test-prescription.png', 'prescription', 'TEST Prescription - Medicine OPD'],
    ['scratch/test-lab-report.png', 'test_report', 'TEST Lab Report - CBC & Sugar'],
]) {
    const path = `${patient.id}/TEST-ui-${Date.now()}-${type}.png`;
    const up = await db.storage.from('medical_documents').upload(path, readFileSync(file), { contentType: 'image/png' });
    if (up.error) throw up.error;
    const { data: rec, error } = await db.from('medical_records').insert({
        patient_id: patient.id, uploaded_by: patient.auth_user_id, record_type: type, title,
        file_path: path, file_type: 'image/png', file_size: readFileSync(file).length,
    }).select('id').single();
    if (error) throw error;
    console.log(type, rec.id, (await processRecord(rec.id)).status);
}
