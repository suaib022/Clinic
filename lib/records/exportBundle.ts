import type { SupabaseClient } from '@supabase/supabase-js';
import { loadHealthData, type HealthData } from '@/lib/extraction/healthData';

export type ExportFilters = {
    types: string[];          // record_type values; empty = all
    from?: string | null;     // YYYY-MM-DD, inclusive (document_date)
    to?: string | null;
    includeSummary: boolean;
};

export type ExportDocument = {
    id: string;
    title: string;
    record_type: string;
    document_date: string | null;
    doctor: string | null;
    file_type: string | null;
    file_path: string;
    url: string | null;       // short-lived signed download URL
};

export type ExportBundle = {
    exportedAt: string;
    patient: { uhid: string | null; full_name: string; gender: string | null; dob: string | null };
    documents: ExportDocument[];
    health: HealthData | null;
};

const SIGNED_URL_SECONDS = 600;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Collects everything needed to build a records ZIP for one patient.
 * No access check here: callers must verify the user may export this patient first.
 * `db` must be able to read the patient's records and sign storage URLs (service role).
 */
export async function buildExportBundle(db: SupabaseClient, patientId: string, filters: ExportFilters): Promise<ExportBundle> {
    const { data: patient, error: pErr } = await db
        .from('patients').select('uhid, full_name, gender, dob').eq('id', patientId).single();
    if (pErr || !patient) throw new Error('Patient not found');

    let q = db.from('medical_records')
        .select('id, title, record_type, document_date, file_type, file_path, doctor:doctor_id(full_name), appointment:appointments!medical_records_appointment_id_fkey(doctors:doctor_id(full_name))')
        .eq('patient_id', patientId)
        .eq('is_deleted', false)
        .order('document_date', { ascending: true })
        .order('created_at', { ascending: true });
    if (filters.types.length) q = q.in('record_type', filters.types);
    if (filters.from && DATE.test(filters.from)) q = q.gte('document_date', filters.from);
    if (filters.to && DATE.test(filters.to)) q = q.lte('document_date', filters.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const paths = (rows || []).map(r => r.file_path).filter(Boolean);
    const signed = paths.length
        ? (await db.storage.from('medical_documents').createSignedUrls(paths, SIGNED_URL_SECONDS)).data || []
        : [];
    const urlByPath = new Map(signed.map(s => [s.path, s.error ? null : s.signedUrl]));

    type Row = {
        id: string; title: string; record_type: string; document_date: string | null; file_type: string | null; file_path: string;
        doctor: { full_name?: string } | null;
        appointment: { doctors: { full_name?: string } | null } | null;
    };
    const documents: ExportDocument[] = ((rows || []) as unknown as Row[]).map(r => ({
        id: r.id,
        title: r.title,
        record_type: r.record_type,
        document_date: r.document_date,
        doctor: r.doctor?.full_name || r.appointment?.doctors?.full_name || null,
        file_type: r.file_type,
        file_path: r.file_path,
        url: urlByPath.get(r.file_path) ?? null,
    }));

    return {
        exportedAt: new Date().toISOString(),
        patient,
        documents,
        health: filters.includeSummary ? await loadHealthData(db, [patientId]) : null,
    };
}
