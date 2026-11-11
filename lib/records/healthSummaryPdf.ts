import { jsPDF } from 'jspdf';
import type { ExportBundle } from './exportBundle';

const ACCENT: [number, number, number] = [13, 125, 114];
const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;

// Built-in PDF fonts only cover Latin text; other scripts (e.g. Bangla) would print as garbage.
// ponytail: non-Latin characters become '?'; embed a Unicode font if Bangla text must appear in the PDF.
// The full text is always kept in health_summary.json.
const latin = (s: string | number | null | undefined) =>
    String(s ?? '').replace(/[^\x20-\x7E -ÿ\n]/g, '?').replace(/\?{2,}/g, '?');

/** One-file clinical summary of the extracted health data, for handing to another hospital. */
export function buildHealthSummaryPdf(bundle: ExportBundle): Uint8Array {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = PAGE_W - 2 * MARGIN;
    let y = MARGIN;

    const ensure = (h: number) => {
        if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
    };
    const text = (s: string, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 30, 30]) => {
        doc.setFont('helvetica', style).setFontSize(size).setTextColor(...color);
        const lines = doc.splitTextToSize(latin(s), width) as string[];
        const lh = size * 0.45;
        for (const line of lines) { ensure(lh); doc.text(line, MARGIN, y + lh * 0.8); y += lh; }
    };
    const heading = (s: string) => {
        y += 4; ensure(12);
        text(s, 13, 'bold', ACCENT);
        doc.setDrawColor(...ACCENT).setLineWidth(0.4).line(MARGIN, y + 0.5, PAGE_W - MARGIN, y + 0.5);
        y += 3;
    };
    const table = (cols: { label: string; w: number }[], rows: string[][]) => {
        const rowLines = (cells: string[]) => cells.map((c, i) => doc.splitTextToSize(latin(c || '-'), cols[i].w * width - 2) as string[]);
        const draw = (cells: string[][], bold: boolean) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(8.5).setTextColor(30, 30, 30);
            const h = Math.max(...cells.map(l => l.length)) * 3.8 + 1.5;
            ensure(h);
            if (bold) { doc.setFillColor(238, 245, 244).rect(MARGIN, y, width, h, 'F'); }
            let x = MARGIN;
            cells.forEach((lines, i) => { doc.text(lines, x + 1, y + 3.6); x += cols[i].w * width; });
            y += h;
            doc.setDrawColor(220, 220, 220).setLineWidth(0.2).line(MARGIN, y, PAGE_W - MARGIN, y);
        };
        draw(rowLines(cols.map(c => c.label)), true);
        rows.forEach(r => draw(rowLines(r), false));
    };

    const { patient, health } = bundle;
    text('Health Summary', 18, 'bold', ACCENT);
    y += 1;
    text(`${patient.full_name}   |   UHID: ${patient.uhid || '-'}   |   Gender: ${patient.gender || '-'}   |   Date of birth: ${patient.dob || '-'}`, 9.5);
    text(`Exported ${bundle.exportedAt.slice(0, 10)} from the hospital patient portal. Data below was read automatically from uploaded documents; check against the original files in this archive.`, 8, 'normal', [110, 110, 110]);

    if (!health || (!health.medications.length && !health.notes.length && !health.labs.length)) {
        heading('Extracted data');
        text('No extracted data available. See the original documents in this archive.');
        return new Uint8Array(doc.output('arraybuffer'));
    }

    const conditions = [...new Set(health.notes.filter(n => n.note_type === 'diagnosis').map(n => n.content))];
    const allergies = [...new Set(health.notes.filter(n => n.note_type === 'allergy').map(n => n.content))];
    heading('Conditions & Allergies');
    text(`Diagnoses: ${conditions.join('; ') || 'none recorded'}`);
    text(`Allergies: ${allergies.join('; ') || 'none recorded'}`, 10, allergies.length ? 'bold' : 'normal', allergies.length ? [180, 30, 30] : [30, 30, 30]);

    if (health.medications.length) {
        heading('Medications (newest first)');
        table(
            [{ label: 'Date', w: 0.13 }, { label: 'Medicine', w: 0.27 }, { label: 'Strength', w: 0.13 }, { label: 'Dose / Frequency', w: 0.22 }, { label: 'Duration', w: 0.12 }, { label: 'Notes', w: 0.13 }],
            health.medications.map(m => [
                m.prescribed_on || '', [m.form, m.drug_name].filter(Boolean).join(' ') + (m.generic_name ? ` (${m.generic_name})` : ''),
                m.strength || '', [m.dose, m.frequency].filter(Boolean).join(' / '), m.duration || '', m.instructions || '',
            ]),
        );
    }

    const otherNotes = health.notes.filter(n => !['diagnosis', 'allergy'].includes(n.note_type));
    if (otherNotes.length) {
        heading('Clinical Notes');
        table(
            [{ label: 'Date', w: 0.13 }, { label: 'Type', w: 0.15 }, { label: 'Note', w: 0.72 }],
            otherNotes.map(n => [n.noted_on || '', n.note_type.replace('_', ' '), n.content]),
        );
    }

    if (health.labs.length) {
        heading('Test Results');
        const labs = [...health.labs].sort((a, b) => (b.sample_date || '').localeCompare(a.sample_date || '') || a.analyte.localeCompare(b.analyte));
        table(
            [{ label: 'Date', w: 0.13 }, { label: 'Test', w: 0.3 }, { label: 'Result', w: 0.17 }, { label: 'Normal range', w: 0.22 }, { label: 'Flag', w: 0.18 }],
            labs.map(l => [
                l.sample_date || '', l.analyte, `${l.value_num ?? l.value_text ?? ''} ${l.unit || ''}`.trim(),
                l.ref_text || (l.ref_low !== null && l.ref_high !== null ? `${l.ref_low} - ${l.ref_high}` : ''),
                (l.flag || '').toUpperCase(),
            ]),
        );
    }

    const summaries = health.insights.filter(i => i.summary);
    if (summaries.length) {
        heading('Report Summaries');
        for (const i of summaries) {
            text(`- ${i.summary}`, 9.5);
            if (i.abnormal_findings.length) text(`  Abnormal: ${i.abnormal_findings.join('; ')}`, 9, 'normal', [180, 90, 0]);
            y += 1;
        }
    }

    return new Uint8Array(doc.output('arraybuffer'));
}
