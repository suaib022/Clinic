// Prompts, JSON schemas and output sanitizers for document extraction.
// Model output is untrusted: everything goes through sanitize*() before it touches the DB.

export type ExtractableType = 'prescription' | 'test_report';

const NOTE_TYPES = ['complaint', 'diagnosis', 'finding', 'vital', 'advice', 'investigation', 'follow_up', 'allergy', 'other'] as const;
const FLAGS = ['low', 'normal', 'high', 'critical', 'abnormal'] as const;

const str = { type: ['string', 'null'] };
const num = { type: ['number', 'null'] };
const confidence = { type: 'number', description: 'Your confidence in this item, 0 to 1' };
const date = { type: ['string', 'null'], description: 'YYYY-MM-DD, or null if not on the document' };

const obj = (properties: Record<string, unknown>) => ({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
});

const PRIVACY_RULE = `Never output the patient name, age, gender, phone number, address, patient/ticket/national/health ID numbers or any other personal identifier, even if they appear on the document.
Skip administrative text completely: hospital header, ticket info, prices, serial numbers, printed-by lines, signature/seal labels, empty form fields and printed instructions about the ticket.
If the document has no clinical content, return empty arrays.`;

export const PROMPTS: Record<ExtractableType, string> = {
    prescription: `You read medical prescriptions from Bangladesh (printed or handwritten, English or Bangla).
Extract every medicine and every clinical note into the JSON schema.
- drug_name: the brand or drug name exactly as written. generic_name: only if written or certain.
- frequency: keep the local notation (e.g. "1+0+1", "0+0+1") and add meaning if clear (e.g. "1+0+1 (morning, night)").
- duration: as written (e.g. "7 days", "1 month", "continue").
- notes: chief complaints, diagnosis, examination findings, vitals (BP, pulse, weight), advice, tests ordered (investigation), follow-up, allergies.
- If a word is unreadable, give your best reading and a low confidence. Do not invent items that are not on the page.
${PRIVACY_RULE}`,
    test_report: `You read medical test reports (blood, urine, biochemistry, hormone, imaging reports).
Extract every measured result into the JSON schema.
- analyte: the parameter name (e.g. "Hemoglobin", "HbA1c", "Serum Creatinine"). test_name: the panel or test it belongs to (e.g. "CBC").
- value_num: numeric value only; value_text: the value as printed when it is not purely numeric (e.g. "Positive", "Nil", "<5").
- ref_low / ref_high: numeric reference range bounds if printed; ref_text: the range as printed.
- flag: low / normal / high / critical / abnormal based on the printed range or flags, null if unknown.
- summary: 1-3 sentences on what the report shows. abnormal_findings: short list of out-of-range or abnormal results.
- Do not invent values that are not on the page.
${PRIVACY_RULE}`,
};

export const SCHEMAS: Record<ExtractableType, Record<string, unknown>> = {
    prescription: obj({
        prescription_date: date,
        medications: {
            type: 'array',
            items: obj({
                drug_name: { type: 'string' },
                generic_name: str, strength: str, form: str, dose: str,
                frequency: str, duration: str, route: str, instructions: str,
                confidence,
            }),
        },
        notes: {
            type: 'array',
            items: obj({ note_type: { type: 'string', enum: [...NOTE_TYPES] }, content: { type: 'string' }, confidence }),
        },
    }),
    test_report: obj({
        report_date: date,
        results: {
            type: 'array',
            items: obj({
                test_name: str, analyte: { type: 'string' },
                value_num: num, value_text: str, unit: str,
                ref_low: num, ref_high: num, ref_text: str,
                flag: { type: ['string', 'null'], enum: [...FLAGS, null] },
                confidence,
            }),
        },
        summary: str,
        abnormal_findings: { type: 'array', items: { type: 'string' } },
    }),
};

// ── sanitizers ──

type Raw = Record<string, unknown>;

// Defense in depth: models do not always follow the privacy rule.
// Items that look like identity/admin fields are dropped; phone numbers and emails are redacted from any text.
const IDENTITY_FIELD = /\b(name|patient\s*id|contact|mobile|phone|national\s*id|nid|health\s*id|uhid|address|ticket|printed\s*by|bmdc|age\s*:|gender\s*:|sex\s*:|department\s*:|serial|room|ward|bed\s*no)\b|নাম|ঠিকানা|মোবাইল/i;
const PHONE = /(?:\+?88)?0?1[3-9]\d{8}\b|\b\d{3}[-\s]?\d{3,4}[-\s]?\d{4}\b/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

const asText = (v: unknown, max = 500): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.replace(PHONE, '[redacted]').replace(EMAIL, '[redacted]').trim();
    return t ? t.slice(0, max) : null;
};
const looksLikeIdentity = (t: string) => IDENTITY_FIELD.test(t) || t.includes('[redacted]');
const asNum = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '')) : NaN;
    return Number.isFinite(n) ? n : null;
};
const asDate = (v: unknown): string | null =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : null;
const asConfidence = (v: unknown): number | null => {
    const n = asNum(v);
    return n === null ? null : Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
};
const asEnum = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : null;
const asArray = (v: unknown): Raw[] =>
    Array.isArray(v) ? v.filter((x): x is Raw => !!x && typeof x === 'object') : [];

export function sanitizePrescription(raw: Raw) {
    return {
        date: asDate(raw.prescription_date),
        medications: asArray(raw.medications)
            .map(m => ({
                drug_name: asText(m.drug_name, 200),
                generic_name: asText(m.generic_name, 200),
                strength: asText(m.strength, 100),
                form: asText(m.form, 100),
                dose: asText(m.dose, 100),
                frequency: asText(m.frequency, 200),
                duration: asText(m.duration, 100),
                route: asText(m.route, 100),
                instructions: asText(m.instructions),
                confidence: asConfidence(m.confidence),
            }))
            .filter((m): m is typeof m & { drug_name: string } => !!m.drug_name),
        notes: asArray(raw.notes)
            .map(n => ({
                note_type: asEnum(n.note_type, NOTE_TYPES) ?? 'other',
                content: asText(n.content, 2000),
                confidence: asConfidence(n.confidence),
            }))
            .filter((n): n is typeof n & { content: string } => !!n.content && n.content.length >= 4 && !looksLikeIdentity(n.content)),
    };
}

export function sanitizeTestReport(raw: Raw) {
    return {
        date: asDate(raw.report_date),
        results: asArray(raw.results)
            .map(r => ({
                test_name: asText(r.test_name, 200),
                analyte: asText(r.analyte, 200),
                value_num: asNum(r.value_num),
                value_text: asText(r.value_text, 200),
                unit: asText(r.unit, 50),
                ref_low: asNum(r.ref_low),
                ref_high: asNum(r.ref_high),
                ref_text: asText(r.ref_text, 200),
                flag: asEnum(r.flag, FLAGS),
                confidence: asConfidence(r.confidence),
            }))
            // The printed range beats the model's judgement: models misread boundaries (e.g. 11,800 vs 4,000-11,000 as "normal").
            .map(r => r.value_num !== null && r.ref_low !== null && r.ref_high !== null && r.flag !== 'critical'
                ? { ...r, flag: r.value_num < r.ref_low ? 'low' as const : r.value_num > r.ref_high ? 'high' as const : 'normal' as const }
                : r)
            .filter((r): r is typeof r & { analyte: string } => !!r.analyte && !looksLikeIdentity(r.analyte)),
        summary: asText(raw.summary, 2000),
        abnormal_findings: Array.isArray(raw.abnormal_findings)
            ? raw.abnormal_findings.map(x => asText(x, 300)).filter((x): x is string => !!x && !looksLikeIdentity(x)).slice(0, 50)
            : [],
    };
}
