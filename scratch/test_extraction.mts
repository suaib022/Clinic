// End-to-end extraction check against the real Supabase project.
// Uploads a file, creates a medical_records row, runs processRecord, prints the extracted rows, then cleans up.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/test_extraction.mts [file] [prescription|test_report]
import { readFileSync } from 'node:fs';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processRecord } from '@/lib/extraction/processRecord';

const file = process.argv[2] || 'sample-pres.pdf';
const type = process.argv[3] || 'prescription';
const fileType = file.endsWith('.pdf') ? 'application/pdf' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';

const { data: patient } = await db.from('patients').select('id').limit(1).single();
if (!patient) throw new Error('No patient found');
const path = `${patient.id}/TEST-extraction-${Date.now()}-${file.split('/').pop()}`;

const up = await db.storage.from('medical_documents').upload(path, readFileSync(file), { contentType: fileType });
if (up.error) throw up.error;
const { data: rec, error } = await db.from('medical_records')
    .insert({ patient_id: patient.id, record_type: type, title: 'TEST extraction', file_path: path, file_type: fileType })
    .select('id').single();
if (error) throw error;

try {
    const started = Date.now();
    console.log('result:', await processRecord(rec.id), `${Date.now() - started}ms`);
    const table = type === 'prescription' ? ['rx_medications', 'clinical_notes'] : ['lab_results', 'report_insights'];
    for (const t of table) {
        const { data } = await db.from(t).select('*').eq('record_id', rec.id);
        console.log(`\n${t} (${data?.length ?? 0}):`);
        for (const row of data || []) {
            const { id, record_id, patient_id, created_at, ...rest } = row;
            void id; void record_id; void patient_id; void created_at;
            console.log(' ', JSON.stringify(rest));
        }
    }
} finally {
    await db.from('medical_records').delete().eq('id', rec.id);
    await db.storage.from('medical_documents').remove([path]);
    console.log('\ncleaned up test record and file');
}
