import { zipSync, strToU8, type Zippable } from 'fflate';
import type { ExportBundle, ExportDocument } from './exportBundle';
import { buildHealthSummaryPdf } from './healthSummaryPdf';

const FOLDERS: Record<string, string> = {
    prescription: 'prescriptions',
    test_report: 'test_reports',
    imaging: 'imaging',
    discharge_summary: 'discharge_summaries',
    invoice: 'receipts',
};
const EXT_BY_TYPE: Record<string, string> = {
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};

const slug = (s: string) =>
    s.normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'document';

const csvCell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Folder/file name inside the ZIP, e.g. prescriptions/2026-11-05_Prescription-Dr-Rahman.pdf */
function zipPath(doc: ExportDocument, taken: Set<string>): string {
    const ext = doc.file_path.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || EXT_BY_TYPE[doc.file_type || ''] || 'bin';
    const base = `${FOLDERS[doc.record_type] || 'other'}/${doc.document_date || 'undated'}_${slug(doc.title)}`;
    let name = `${base}.${ext}`;
    for (let i = 2; taken.has(name); i++) name = `${base}_${i}.${ext}`;
    taken.add(name);
    return name;
}

export function exportFileName(bundle: ExportBundle): string {
    return `${slug(bundle.patient.uhid || bundle.patient.full_name || 'patient')}_medical_records_${bundle.exportedAt.slice(0, 10)}.zip`;
}

/**
 * Downloads every document and packs the archive.
 * Works in the browser and in Node; `fetchFile` decides how a signed URL is fetched.
 */
export async function assembleExportZip(
    bundle: ExportBundle,
    fetchFile: (url: string) => Promise<Uint8Array>,
    onProgress?: (done: number, total: number) => void,
): Promise<{ zip: Uint8Array; fileName: string; included: number; missing: string[] }> {
    const files: Zippable = {};
    const taken = new Set<string>();
    const rows: string[][] = [];
    const missing: string[] = [];
    const sourceFile = new Map<string, string>();
    let done = 0;

    // Download 4 at a time; documents are already compressed (PDF/JPG/PNG), so store them without recompressing.
    const queue = bundle.documents.map(d => ({ d, path: zipPath(d, taken) }));
    const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            const { d, path } = item;
            try {
                if (!d.url) throw new Error('no download link');
                files[path] = [await fetchFile(d.url), { level: 0 }];
                sourceFile.set(d.id, path);
                rows.push([d.document_date || '', d.record_type, d.title, d.doctor || '', path, 'included']);
            } catch {
                missing.push(d.title);
                rows.push([d.document_date || '', d.record_type, d.title, d.doctor || '', '', 'missing - could not download']);
            }
            onProgress?.(++done, bundle.documents.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length || 1) }, worker));
    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));

    files['documents.csv'] = strToU8(
        [['date', 'type', 'title', 'doctor', 'file', 'status'], ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n',
    );

    if (bundle.health) {
        const h = bundle.health;
        const src = (recordId: string) => sourceFile.get(recordId) || null;
        files['health_summary.json'] = strToU8(JSON.stringify({
            exported_at: bundle.exportedAt,
            patient: bundle.patient,
            note: 'Read automatically from the uploaded documents. Check against the original files.',
            medications: h.medications.map(({ id, patient_id, record_id, ...m }) => (void id, void patient_id, { ...m, source_file: src(record_id) })),
            clinical_notes: h.notes.map(({ id, patient_id, record_id, ...n }) => (void id, void patient_id, { ...n, source_file: src(record_id) })),
            lab_results: h.labs.map(({ id, patient_id, record_id, ...l }) => (void id, void patient_id, { ...l, source_file: src(record_id) })),
            report_summaries: h.insights.map(({ patient_id, record_id, ...i }) => (void patient_id, { ...i, source_file: src(record_id) })),
        }, null, 2));
        files['health_summary.pdf'] = [buildHealthSummaryPdf(bundle), { level: 0 }];
    }

    const p = bundle.patient;
    files['README.txt'] = strToU8([
        'MEDICAL RECORDS EXPORT',
        '======================',
        `Patient: ${p.full_name}   UHID: ${p.uhid || '-'}   Gender: ${p.gender || '-'}   Date of birth: ${p.dob || '-'}`,
        `Exported: ${bundle.exportedAt.replace('T', ' ').slice(0, 16)} UTC`,
        '',
        `Documents included: ${bundle.documents.length - missing.length} of ${bundle.documents.length}`,
        ...(missing.length ? ['Could not be downloaded:', ...missing.map(m => `  - ${m}`)] : []),
        '',
        'Contents',
        '  documents.csv         list of every document (date, type, title, doctor, file name)',
        ...(bundle.health ? [
            '  health_summary.pdf    one-page overview: medicines, conditions, allergies, test results',
            '  health_summary.json   same data in machine-readable form',
        ] : []),
        '  prescriptions/        original prescription files',
        '  test_reports/         original lab and test reports',
        '  other folders         imaging, discharge summaries, other documents',
        '',
        'File names start with the document date (YYYY-MM-DD) so they sort in date order.',
        'The health summary is read automatically from the documents; the original files are the reference.',
        'This archive contains personal medical information. Share it only with people you trust.',
        '',
    ].join('\r\n'));

    // ponytail: zipSync builds the archive in memory in one go; switch to fflate's streaming Zip if exports reach hundreds of MB.
    return { zip: zipSync(files), fileName: exportFileName(bundle), included: bundle.documents.length - missing.length, missing };
}
