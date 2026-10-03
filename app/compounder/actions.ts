'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireRole } from '@/lib/auth/requireRole';

export async function updateAppointmentStatus(formData: FormData) {
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    const supabase = await createClient();
    await supabase.from('appointments').update({ status }).eq('id', id);
    revalidatePath('/compounder/dashboard');
}

export async function uploadMedicalRecord(formData: FormData) {
    const cookieStore = await cookies();
    const { user: { id: compounderId } } = await requireRole(['compounder']);
    
    if (!compounderId) throw new Error("Not authenticated");

    const supabase = await createClient();
    const { data: compounder } = await supabase.from('compounders').select('assigned_doctor_id').eq('id', compounderId).single();
    
    const patient_id = formData.get('patient_id') as string;
    const record_type = formData.get('record_type') as string;
    const title = formData.get('title') as string;
    const doctor_id = compounder?.assigned_doctor_id;

    // We simulate file upload since we don't have actual storage integrated here easily without client side
    // In a real app we'd upload the File to storage and get the path.
    const file_path = `uploads/${Date.now()}_dummy.pdf`;

    await supabase.from('medical_records').insert({
        patient_id,
        doctor_id,
        uploaded_by: compounderId,
        record_type,
        title,
        file_path
    });

    // Log the access since the compounder modified the patient's record
    await supabase.rpc('log_patient_access', {
        p_patient_id: patient_id,
        p_action: 'Uploaded medical record'
    });

    revalidatePath('/compounder/upload');
    return { success: true };
}
