import type { SupabaseClient } from '@supabase/supabase-js';

export type Medication = {
    id: string; record_id: string; patient_id: string; drug_name: string; generic_name: string | null;
    strength: string | null; form: string | null; dose: string | null; frequency: string | null;
    duration: string | null; instructions: string | null; prescribed_on: string | null;
};
export type ClinicalNote = {
    id: string; record_id: string; patient_id: string; note_type: string; content: string; noted_on: string | null;
};
export type LabResult = {
    id: string; record_id: string; patient_id: string; test_name: string | null; analyte: string;
    value_num: number | null; value_text: string | null; unit: string | null;
    ref_low: number | null; ref_high: number | null; ref_text: string | null; flag: string | null; sample_date: string | null;
};
export type ReportInsight = {
    record_id: string; patient_id: string; summary: string | null; abnormal_findings: string[]; created_at: string;
};
export type HealthData = { medications: Medication[]; notes: ClinicalNote[]; labs: LabResult[]; insights: ReportInsight[] };

/** Extracted data for the given patients. Uses the caller's client, so RLS decides what is visible. */
export async function loadHealthData(supabase: SupabaseClient, patientIds: string[]): Promise<HealthData> {
    if (patientIds.length === 0) return { medications: [], notes: [], labs: [], insights: [] };
    const [medications, notes, labs, insights] = await Promise.all([
        supabase.from('rx_medications')
            .select('id, record_id, patient_id, drug_name, generic_name, strength, form, dose, frequency, duration, instructions, prescribed_on')
            .in('patient_id', patientIds).order('prescribed_on', { ascending: false, nullsFirst: false }),
        supabase.from('clinical_notes')
            .select('id, record_id, patient_id, note_type, content, noted_on')
            .in('patient_id', patientIds).order('noted_on', { ascending: false, nullsFirst: false }),
        supabase.from('lab_results')
            .select('id, record_id, patient_id, test_name, analyte, value_num, value_text, unit, ref_low, ref_high, ref_text, flag, sample_date')
            .in('patient_id', patientIds).order('sample_date', { ascending: true, nullsFirst: true }),
        supabase.from('report_insights')
            .select('record_id, patient_id, summary, abnormal_findings, created_at')
            .in('patient_id', patientIds).order('created_at', { ascending: false }),
    ]);
    return {
        medications: (medications.data || []) as Medication[],
        notes: (notes.data || []) as ClinicalNote[],
        labs: (labs.data || []) as LabResult[],
        insights: (insights.data || []) as ReportInsight[],
    };
}
