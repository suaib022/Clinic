'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildExportBundle, type ExportBundle, type ExportFilters } from './exportBundle';

/** Patient-facing export: checks the signed-in account owns the profile, then builds the bundle. */
export async function getExportBundle(
    patientId: string,
    filters: ExportFilters,
): Promise<{ bundle?: ExportBundle; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Please sign in again' };

    const { data: owner } = await supabaseAdmin
        .from('patients').select('id').eq('id', patientId).eq('auth_user_id', user.id).maybeSingle();
    if (!owner) return { error: 'You can only export profiles on your own account' };

    try {
        const bundle = await buildExportBundle(supabaseAdmin, patientId, filters);
        await supabase.rpc('log_patient_access', { p_patient_id: patientId, p_action: `Exported ${bundle.documents.length} medical records` });
        return { bundle };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Export failed' };
    }
}
