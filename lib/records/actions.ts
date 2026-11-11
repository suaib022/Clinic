'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const COMPOUNDER_RETRACT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Single delete path for medical documents.
 * Hard-deletes the medical_records row (extracted data goes with it via ON DELETE CASCADE)
 * and removes the file from storage.
 */
export async function deleteMedicalRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not signed in' };

    const { data: userRow } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
    const role = userRow?.role;

    const { data: record } = await supabaseAdmin
        .from('medical_records')
        .select('id, patient_id, uploaded_by, created_at, file_path')
        .eq('id', recordId)
        .single();
    if (!record) return { success: false, error: 'Document not found' };

    let allowed = role === 'admin';
    if (role === 'patient' && record.uploaded_by === user.id) {
        const { data: owner } = await supabaseAdmin
            .from('patients')
            .select('id')
            .eq('id', record.patient_id)
            .eq('auth_user_id', user.id)
            .maybeSingle();
        allowed = !!owner;
    }
    if (role === 'compounder' && record.uploaded_by === user.id) {
        allowed = Date.now() - new Date(record.created_at).getTime() <= COMPOUNDER_RETRACT_WINDOW_MS;
    }
    if (!allowed) return { success: false, error: 'You are not allowed to delete this document' };

    // Row first: once it is gone the document and its extracted data are unreachable,
    // even if storage cleanup fails below.
    const { error: dbError } = await supabaseAdmin.from('medical_records').delete().eq('id', recordId);
    if (dbError) return { success: false, error: dbError.message };

    if (record.file_path) {
        const { error: storageError } = await supabaseAdmin.storage.from('medical_documents').remove([record.file_path]);
        if (storageError) console.error(`Storage cleanup failed for ${record.file_path}:`, storageError.message);
    }

    await supabase.rpc('log_patient_access', { p_patient_id: record.patient_id, p_action: 'Deleted medical record' });

    revalidatePath('/patient/records');
    revalidatePath('/compounder/upload');
    return { success: true };
}
