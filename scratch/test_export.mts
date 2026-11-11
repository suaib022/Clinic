// End-to-end check of the records ZIP export (same code the browser runs), then cleanup.
// Seeds the two test documents for one patient, builds bundles with different filters, unpacks and checks the ZIP.
// Run: npx tsx --conditions=react-server --env-file=.env.local scratch/test_export.mts [UHID]
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { supabaseAdmin as db } from '@/lib/supabase/admin';
import { processRecord } from '@/lib/extraction/processRecord';
import { buildExportBundle } from '@/lib/records/exportBundle';
import { assembleExportZip } from '@/lib/records/exportZip';

const uhid = process.argv[2] || 'UHID18999443';
const { data: patient } = await db.from('patients').select('id, uhid').eq('uhid', uhid).single();
if (!patient) throw new Error(`No patient ${uhid}`);
const fetchFile = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
};

const created: { id: string; path: string }[] = [];
try {
    // Two documents with the same title on purpose, to check duplicate file names.
    for (const [file, type, title, date] of [
        ['scratch/test-prescription.png', 'prescription', 'TEST Prescription', '2026-11-05'],
        ['scratch/test-lab-report.png', 'test_report', 'TEST CBC Report', '2026-11-02'],
        ['sample-pres.pdf', 'other', 'TEST Prescription', '2026-10-01'],
    ]) {
        const path = `${patient.id}/TEST-export-${Date.now()}-${file.split('/').pop()}`;
        const contentType = file.endsWith('.pdf') ? 'application/pdf' : 'image/png';
        const up = await db.storage.from('medical_documents').upload(path, readFileSync(file), { contentType });
        if (up.error) throw up.error;
        const { data: rec, error } = await db.from('medical_records').insert({
            patient_id: patient.id, record_type: type, title, file_path: path, file_type: contentType, document_date: date,
        }).select('id').single();
        if (error) throw error;
        created.push({ id: rec.id, path });
        if (type !== 'other') await processRecord(rec.id);
    }
    const ours = (names: string[]) => names.filter(n => n.includes('TEST'));

    // 1. Everything
    const all = await buildExportBundle(db, patient.id, { types: [], includeSummary: true });
    const res = await assembleExportZip(all, fetchFile);
    const entries = unzipSync(res.zip);
    const names = Object.keys(entries).sort();
    console.log('zip file:', res.fileName, `${(res.zip.length / 1024).toFixed(0)} KB`);
    console.log('entries:', names);
    assert.ok(res.fileName.startsWith(`${uhid}_medical_records_`));
    for (const f of ['README.txt', 'documents.csv', 'health_summary.pdf', 'health_summary.json']) assert.ok(entries[f], `missing ${f}`);
    assert.ok(names.includes('prescriptions/2026-11-05_TEST-Prescription.png'));
    assert.ok(names.includes('test_reports/2026-11-02_TEST-CBC-Report.png'));
    assert.ok(names.includes('other/2026-10-01_TEST-Prescription.pdf'));
    assert.deepEqual(entries['prescriptions/2026-11-05_TEST-Prescription.png'], new Uint8Array(readFileSync('scratch/test-prescription.png')), 'file bytes intact');
    assert.equal(strFromU8(entries['health_summary.pdf'].slice(0, 5)), '%PDF-');
    assert.equal(res.missing.length, 0);

    const csv = strFromU8(entries['documents.csv']);
    console.log('\ndocuments.csv (test rows):\n' + csv.split('\r\n').filter((l, i) => i === 0 || l.includes('TEST')).join('\n'));
    const json = JSON.parse(strFromU8(entries['health_summary.json']));
    const testMeds = json.medications.filter((m: { source_file: string | null }) => m.source_file?.includes('TEST'));
    console.log('\nhealth_summary.json: meds from test docs', testMeds.length, '| sample:', JSON.stringify(testMeds[0]));
    assert.equal(testMeds.length, 4);
    assert.ok(!JSON.stringify(json).includes('patient_id'), 'no internal ids in JSON');
    console.log('\nREADME.txt:\n' + strFromU8(entries['README.txt']));
    writeFileSync('scratch/export-sample.zip', res.zip);
    writeFileSync('scratch/export-sample-summary.pdf', entries['health_summary.pdf']);

    // 2. Filters: prescriptions only, no summary
    const rxOnly = await buildExportBundle(db, patient.id, { types: ['prescription'], includeSummary: false });
    const rxNames = Object.keys(unzipSync((await assembleExportZip(rxOnly, fetchFile)).zip));
    assert.deepEqual(ours(rxNames), ['prescriptions/2026-11-05_TEST-Prescription.png']);
    assert.ok(!rxNames.includes('health_summary.pdf'));
    // 3. Date range: only 2026-11-01..2026-11-03
    const ranged = await buildExportBundle(db, patient.id, { types: [], from: '2026-11-01', to: '2026-11-03', includeSummary: false });
    assert.deepEqual(ours(ranged.documents.map(d => d.title)), ['TEST CBC Report']);
    // 4. A broken link is reported, not fatal
    const broken = { ...all, documents: all.documents.map((d, i) => (i === 0 ? { ...d, url: null } : d)) };
    const brokenRes = await assembleExportZip(broken, fetchFile);
    assert.equal(brokenRes.missing.length, 1);
    assert.ok(strFromU8(unzipSync(brokenRes.zip)['README.txt']).includes('Could not be downloaded'));
    console.log('\nall export checks passed');
} finally {
    for (const c of created) {
        await db.from('medical_records').delete().eq('id', c.id);
        await db.storage.from('medical_documents').remove([c.path]);
    }
    console.log('cleaned up', created.length, 'test documents');
}
