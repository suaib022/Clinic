import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PROMPTS, SCHEMAS, sanitizePrescription, sanitizeTestReport, type ExtractableType } from './schemas';

const MODEL = process.env.EXTRACTION_MODEL || 'google/gemini-2.5-flash-lite';
const MAX_ATTEMPTS = 3;
const MAX_PDF_PAGES = 5;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type ProcessResult = { recordId: string; status: 'done' | 'failed' | 'skipped'; error?: string };

/** Turn the stored file into page images (data URLs) the vision model can read. */
async function toImageDataUrls(file: Buffer, fileType: string | null, path: string): Promise<string[]> {
    const isPdf = fileType === 'application/pdf' || path.toLowerCase().endsWith('.pdf');
    if (isPdf) {
        const { pdf } = await import('pdf-to-img');
        const doc = await pdf(file, { scale: 2 });
        const pages: string[] = [];
        for await (const png of doc) {
            pages.push(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
            if (pages.length >= MAX_PDF_PAGES) break;
        }
        return pages;
    }
    if (fileType && IMAGE_TYPES.includes(fileType)) {
        // ponytail: phone photos are sent at full size; downscale with sharp if token cost matters.
        return [`data:${fileType};base64,${file.toString('base64')}`];
    }
    throw new Error(`Unsupported file type for extraction: ${fileType || 'unknown'}`);
}

async function callModel(type: ExtractableType, images: string[]): Promise<Record<string, unknown>> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    // Providers return 429/5xx under load; retry twice with backoff before failing the record.
    const RETRY_DELAYS_MS = [3_000, 10_000];
    let res: Response;
    for (let attempt = 0; ; attempt++) {
        res = await requestModel(apiKey, type, images);
        if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= RETRY_DELAYS_MS.length) break;
        console.warn(`[extraction] OpenRouter ${res.status}, retrying in ${RETRY_DELAYS_MS[attempt] / 1000}s`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body?.error?.message || res.statusText}`);
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Model returned no content');
    if (body?.usage) console.log(`[extraction] ${MODEL} tokens in=${body.usage.prompt_tokens} out=${body.usage.completion_tokens}`);

    // Some providers wrap JSON in a code fence even in JSON mode.
    const json = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Model output is not a JSON object');
    return parsed;
}

function requestModel(apiKey: string, type: ExtractableType, images: string[]): Promise<Response> {
    return fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0,
            messages: [
                { role: 'system', content: PROMPTS[type] },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Extract the data from this ${type === 'prescription' ? 'prescription' : 'test report'} (${images.length} page(s)).` },
                        ...images.map(url => ({ type: 'image_url', image_url: { url } })),
                    ],
                },
            ],
            response_format: { type: 'json_schema', json_schema: { name: type, strict: true, schema: SCHEMAS[type] } },
            provider: { require_parameters: true },
        }),
        signal: AbortSignal.timeout(120_000),
    });
}

/** Replace all extracted rows for one record (safe to re-run). */
async function saveExtraction(
    record: { id: string; patient_id: string; record_type: ExtractableType; document_date: string | null },
    raw: Record<string, unknown>,
) {
    const db = supabaseAdmin;
    const { id: record_id, patient_id } = record;

    for (const table of ['rx_medications', 'clinical_notes', 'lab_results', 'report_insights', 'record_extractions']) {
        const { error } = await db.from(table).delete().eq('record_id', record_id);
        if (error) throw new Error(`Clear ${table}: ${error.message}`);
    }

    const insert = async (table: string, rows: object[]) => {
        if (rows.length === 0) return;
        const { error } = await db.from(table).insert(rows);
        if (error) throw new Error(`Insert ${table}: ${error.message}`);
    };

    if (record.record_type === 'prescription') {
        const rx = sanitizePrescription(raw);
        const on = rx.date ?? record.document_date;
        await insert('rx_medications', rx.medications.map(m => ({ ...m, record_id, patient_id, prescribed_on: on })));
        await insert('clinical_notes', rx.notes.map(n => ({ ...n, record_id, patient_id, noted_on: on })));
    } else {
        const tr = sanitizeTestReport(raw);
        const on = tr.date ?? record.document_date;
        await insert('lab_results', tr.results.map(r => ({ ...r, record_id, patient_id, sample_date: on })));
        await insert('report_insights', [{ record_id, patient_id, summary: tr.summary, abnormal_findings: tr.abnormal_findings }]);
    }

    await insert('record_extractions', [{ record_id, patient_id, record_type: record.record_type, raw, model: MODEL }]);
}

/**
 * Process one medical record: claim it, read the file, call the model, store the result.
 * Only records in 'pending' or 'failed' (with attempts left) are processed; others are skipped.
 */
export async function processRecord(recordId: string): Promise<ProcessResult> {
    const db = supabaseAdmin;

    const { data: rec } = await db
        .from('medical_records')
        .select('id, patient_id, record_type, file_path, file_type, document_date, extraction_status, extraction_attempts')
        .eq('id', recordId)
        .single();
    if (!rec || !['pending', 'failed'].includes(rec.extraction_status) || rec.extraction_attempts >= MAX_ATTEMPTS) {
        return { recordId, status: 'skipped' };
    }

    // Claim: only one worker wins (status + attempts must still match what we read).
    const { data: claimed } = await db
        .from('medical_records')
        .update({ extraction_status: 'processing', extraction_attempts: rec.extraction_attempts + 1, extraction_error: null })
        .eq('id', recordId)
        .eq('extraction_status', rec.extraction_status)
        .eq('extraction_attempts', rec.extraction_attempts)
        .select('id');
    if (!claimed?.length) return { recordId, status: 'skipped' };

    try {
        const { data: blob, error: dlError } = await db.storage.from('medical_documents').download(rec.file_path);
        if (dlError || !blob) throw new Error(`Download failed: ${dlError?.message || 'no file'}`);
        const file = Buffer.from(await blob.arrayBuffer());

        const images = await toImageDataUrls(file, rec.file_type, rec.file_path);
        if (images.length === 0) throw new Error('Document has no pages');

        const raw = await callModel(rec.record_type as ExtractableType, images);
        await saveExtraction(rec as Parameters<typeof saveExtraction>[0], raw);

        await db.from('medical_records').update({
            extraction_status: 'done',
            extraction_model: MODEL,
            extracted_at: new Date().toISOString(),
            file_hash: createHash('sha256').update(file).digest('hex'),
        }).eq('id', recordId);
        return { recordId, status: 'done' };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[extraction] record ${recordId} failed:`, message);
        await db.from('medical_records').update({ extraction_status: 'failed', extraction_error: message.slice(0, 1000) }).eq('id', recordId);
        return { recordId, status: 'failed', error: message };
    }
}

/** Retry sweep: process queued and failed records (oldest first). */
export async function processQueue(limit = 5): Promise<ProcessResult[]> {
    const { data } = await supabaseAdmin
        .from('medical_records')
        .select('id')
        .in('extraction_status', ['pending', 'failed'])
        .lt('extraction_attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(limit);

    const results: ProcessResult[] = [];
    for (const { id } of data || []) results.push(await processRecord(id)); // sequential: keeps rate limits and memory low
    return results;
}
