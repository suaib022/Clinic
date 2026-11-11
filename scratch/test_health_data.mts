// Checks the Health Profile data query against real extracted rows, then cleans up.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/test_health_data.mts
import { readFileSync } from 'node:fs';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processRecord } from '@/lib/extraction/processRecord';
import { loadHealthData } from '@/lib/extraction/healthData';

const { data: patient } = await db.from('patients').select('id').limit(1).single();
if (!patient) throw new Error('No patient found');

const docs = [['scratch/test-prescription.png', 'prescription'], ['scratch/test-lab-report.png', 'test_report']];
const created: { id: string; path: string }[] = [];
try {
    for (const [file, type] of docs) {
        const path = `${patient.id}/TEST-profile-${Date.now()}-${type}.png`;
        const up = await db.storage.from('medical_documents').upload(path, readFileSync(file), { contentType: 'image/png' });
        if (up.error) throw up.error;
        const { data: rec, error } = await db.from('medical_records')
            .insert({ patient_id: patient.id, record_type: type, title: 'TEST profile', file_path: path, file_type: 'image/png' })
            .select('id').single();
        if (error) throw error;
        created.push({ id: rec.id, path });
        console.log(type, (await processRecord(rec.id)).status);
    }
    const h = await loadHealthData(db, [patient.id]);
    const ours = new Set(created.map(c => c.id));
    const count = <T extends { record_id: string }>(rows: T[]) => rows.filter(r => ours.has(r.record_id)).length;
    console.log({ medications: count(h.medications), notes: count(h.notes), labs: count(h.labs), insights: count(h.insights) });
} finally {
    for (const c of created) {
        await db.from('medical_records').delete().eq('id', c.id);
        await db.storage.from('medical_documents').remove([c.path]);
    }
    console.log('cleaned up');
}
