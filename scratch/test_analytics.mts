// Checks the analytics views: seeds the two test documents for 3 patients, reads the views
// as admin (service role) and as an anonymous client (must see nothing), then cleans up.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/test_analytics.mts
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processRecord } from '@/lib/extraction/processRecord';

const { data: patients } = await db.from('patients').select('id').limit(3);
if (!patients || patients.length < 3) throw new Error('Need 3 patients');

const created: { id: string; path: string }[] = [];
try {
    for (const p of patients) {
        for (const [file, type] of [['scratch/test-prescription.png', 'prescription'], ['scratch/test-lab-report.png', 'test_report']]) {
            const path = `${p.id}/TEST-analytics-${Date.now()}-${type}.png`;
            const up = await db.storage.from('medical_documents').upload(path, readFileSync(file), { contentType: 'image/png' });
            if (up.error) throw up.error;
            const { data: rec, error } = await db.from('medical_records')
                .insert({ patient_id: p.id, record_type: type, title: 'TEST analytics', file_path: path, file_type: 'image/png' })
                .select('id').single();
            if (error) throw error;
            created.push({ id: rec.id, path });
        }
    }
    const results = await Promise.all(created.map(c => processRecord(c.id)));
    console.log('extraction:', results.map(r => r.status).join(','));

    for (const v of ['analytics_diagnoses', 'analytics_medications', 'analytics_lab_tests', 'analytics_allergies', 'analytics_extraction_status']) {
        const { data, error } = await db.from(v).select('*').limit(4);
        console.log(`\n${v}:`, error ? error.message : '');
        for (const row of data || []) console.log(' ', JSON.stringify(row));
    }

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const anonRead = await anon.from('analytics_lab_tests').select('*');
    console.log('\nanonymous client sees:', anonRead.error ? `error (${anonRead.error.code})` : `${anonRead.data.length} rows`);
} finally {
    for (const c of created) {
        await db.from('medical_records').delete().eq('id', c.id);
        await db.storage.from('medical_documents').remove([c.path]);
    }
    console.log('cleaned up', created.length, 'test documents');
}
