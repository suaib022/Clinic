// Offline check of the output sanitizers (no API, no DB).
// Run: npx tsx scratch/test_sanitize.mts
import assert from 'node:assert/strict';
import { sanitizePrescription, sanitizeTestReport } from '@/lib/extraction/schemas';

const rx = sanitizePrescription({
    prescription_date: '05/11/2026',
    medications: [{ drug_name: 'Napa', frequency: '1+0+1', confidence: 3 }, { drug_name: '' }],
    notes: [
        { note_type: 'diagnosis', content: 'Acid peptic disease', confidence: 0.9 },
        { note_type: 'other', content: 'Name :SHAHJALAL' },
        { note_type: 'other', content: 'Contact :01867271008' },
        { note_type: 'advice', content: 'Call 01712345678 if fever persists' },
        { note_type: 'other', content: 'Department: Medicine (Serial: 20)' },
        { note_type: 'other', content: 'Rx' },
        { note_type: 'bogus', content: 'Penicillin allergy' },
    ],
});
assert.equal(rx.date, null, 'non-ISO date rejected');
assert.deepEqual(rx.medications.map(m => [m.drug_name, m.confidence]), [['Napa', 1]], 'empty drug dropped, confidence clamped');
assert.deepEqual(rx.notes.map(n => [n.note_type, n.content]), [
    ['diagnosis', 'Acid peptic disease'],
    ['other', 'Penicillin allergy'],
], 'identity, phone, admin and junk notes dropped; unknown note_type becomes other');

const tr = sanitizeTestReport({
    report_date: '2026-11-02',
    results: [
        { analyte: 'WBC Count', value_num: '11,800', ref_low: 4000, ref_high: 11000, flag: 'normal' },
        { analyte: 'Hemoglobin', value_num: 10.2, ref_low: 13, ref_high: 17, flag: 'normal' },
        { analyte: 'Platelet', value_num: 250000, ref_low: 150000, ref_high: 450000, flag: 'high' },
        { analyte: 'Urine Sugar', value_text: 'Nil', flag: 'normal' },
        { analyte: 'Patient Name', value_text: 'Karim' },
    ],
    summary: 'Contact 01898765432 for details. Anemia.',
    abnormal_findings: ['Low Hb', 'Name: Karim'],
});
assert.deepEqual(tr.results.map(r => [r.analyte, r.value_num, r.flag]), [
    ['WBC Count', 11800, 'high'],
    ['Hemoglobin', 10.2, 'low'],
    ['Platelet', 250000, 'normal'],
    ['Urine Sugar', null, 'normal'],
]);
assert.ok(!tr.summary?.includes('01898765432'), 'phone redacted from summary');
assert.deepEqual(tr.abnormal_findings, ['Low Hb']);
console.log('sanitize checks passed');
