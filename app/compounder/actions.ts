'use server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';

// ──── APPOINTMENT ACTIONS ────

export async function checkInAppointment(appointmentId: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('check_in_appointment', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function undoCheckIn(appointmentId: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('undo_check_in', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function markNoShow(appointmentId: string, reason: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('mark_no_show', { p_id: appointmentId, p_reason: reason || 'Patient did not arrive' });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function setPriority(appointmentId: string, reason: string) {
    if (!reason?.trim()) return { success: false, error: 'Priority reason is required' };
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('set_priority', { p_id: appointmentId, p_reason: reason });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function retractWalkIn(appointmentId: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('retract_walk_in', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

// ──── WALK-IN FLOW ────

export async function lookupPatient(query: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    
    // Normalize the query
    const normalized = normalizePhoneNumber(query.trim());
    
    const { data, error } = await supabase.rpc('lookup_patient_for_walk_in', { p_query: normalized });
    if (error) return { success: false, error: friendlyError(error.message), patients: [] };
    return { success: true, patients: data || [] };
}

export async function createWalkInAppointment(
    patientId: string,
    visitType: string,
    isPriority: boolean,
    priorityReason: string,
    idempotencyKey: string
) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    
    // Check for existing active appointment first (client-friendly message)
    const { data: appointmentId, error } = await supabase.rpc('create_walk_in_appointment', {
        p_patient_id: patientId,
        p_visit_type: visitType,
        p_is_priority: isPriority,
        p_priority_reason: priorityReason || '',
        p_idempotency_key: idempotencyKey
    });
    
    if (error) return { success: false, error: friendlyError(error.message) };
    
    // Fetch the created appointment to get serial number
    const { data: appt } = await supabase
        .from('appointments')
        .select('serial_no, appointment_date, start_time')
        .eq('id', appointmentId)
        .single();
    
    revalidatePath('/compounder');
    return { success: true, appointmentId, serialNo: appt?.serial_no };
}

export async function registerNewPatient(
    fullName: string,
    mobile: string,
    gender: string,
    title: string
) {
    const { user } = await requireRole(['compounder']);
    
    const normalizedMobile = normalizePhoneNumber(mobile.trim());
    
    // Check if mobile already exists
    const { data: existing } = await supabaseAdmin
        .from('patients')
        .select('id, full_name, uhid')
        .eq('mobile', normalizedMobile)
        .limit(1);
    
    if (existing && existing.length > 0) {
        return { 
            success: false, 
            error: `A patient with this mobile number already exists (${existing[0].full_name}, UHID: ${existing[0].uhid}). Please use the lookup to find them.` 
        };
    }
    
    // Generate UHID
    const { data: lastPatient } = await supabaseAdmin
        .from('patients')
        .select('uhid')
        .order('created_at', { ascending: false })
        .limit(1);
    
    const lastNum = lastPatient?.[0]?.uhid ? parseInt(lastPatient[0].uhid.replace(/[^0-9]/g, '')) : 0;
    const newUhid = `UHID-${String(lastNum + 1).padStart(6, '0')}`;
    
    // Generate PIN (6-digit)
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    
    // Create auth user
    const email = `patient_${Date.now()}@clinic.local`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { full_name: fullName }
    });
    
    if (authError) return { success: false, error: 'Failed to create patient account: ' + authError.message };
    
    // Create users record
    await supabaseAdmin.from('users').upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: 'patient'
    });
    
    // Create patient record
    const { data: newPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
            auth_user_id: authData.user.id,
            full_name: fullName,
            mobile: normalizedMobile,
            gender,
            title,
            uhid: newUhid,
            is_active: true
        })
        .select('id, uhid')
        .single();
    
    if (patientError) return { success: false, error: 'Failed to create patient record: ' + patientError.message };
    
    // Return the UHID and PIN - the PIN is returned ONCE and never stored in plaintext
    return { 
        success: true, 
        patientId: newPatient.id, 
        uhid: newPatient.uhid, 
        pin,
        email
    };
}

// ──── UPLOAD (existing Module 2) ────

export async function uploadMedicalRecord(formData: FormData) {
    const { user: { id: compounderId } } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase.from('compounders').select('assigned_doctor_id').eq('id', compounderId).single();
    
    const patient_id = formData.get('patient_id') as string;
    const record_type = formData.get('record_type') as string;
    const title = formData.get('title') as string;
    const doctor_id = compounder?.assigned_doctor_id;
    const file_path = `uploads/${Date.now()}_dummy.pdf`;

    await supabase.from('medical_records').insert({
        patient_id, doctor_id, uploaded_by: compounderId, record_type, title, file_path
    });
    await supabase.rpc('log_patient_access', { p_patient_id: patient_id, p_action: 'Uploaded medical record' });
    revalidatePath('/compounder/upload');
    return { success: true };
}

// ──── HELPERS ────

function normalizePhoneNumber(input: string): string {
    // Remove spaces, dashes
    let cleaned = input.replace(/[\s\-()]/g, '');
    // Convert +880XXXXXXXXXX to 01XXXXXXXXX
    if (cleaned.startsWith('+880')) {
        cleaned = '0' + cleaned.slice(4);
    }
    // Convert 880XXXXXXXXXX to 01XXXXXXXXX
    if (cleaned.startsWith('880') && cleaned.length === 13) {
        cleaned = '0' + cleaned.slice(3);
    }
    return cleaned;
}

function friendlyError(msg: string): string {
    if (msg.includes('Permission denied')) return 'You do not have permission to perform this action.';
    if (msg.includes('not scheduled')) return 'This appointment is not in the scheduled state.';
    if (msg.includes('not checked in')) return 'This appointment is not checked in.';
    if (msg.includes('Undo time window')) return 'The undo window (5 minutes) has expired.';
    if (msg.includes('Retract time window')) return 'The retract window (5 minutes) has expired.';
    if (msg.includes('Rate limit')) return 'Too many lookups. Please wait a few minutes.';
    if (msg.includes('already has an active')) return 'This patient already has an active appointment with this doctor today. Check in the existing booking instead.';
    if (msg.includes('Outside doctor working hours')) return 'This doctor is not currently working. Walk-ins can only be created during working hours.';
    if (msg.includes('Doctor is on leave')) return 'This doctor is on leave today.';
    if (msg.includes('not found or archived')) return 'Patient not found or has been archived.';
    if (msg.includes('no assigned doctor')) return 'You are not assigned to any doctor. Contact the admin.';
    if (msg.includes('Cannot retract online')) return 'Online bookings cannot be retracted. Only walk-ins can be retracted.';
    if (msg.includes('only the compounder')) return 'Only the person who performed this action can undo it.';
    if (msg.includes('Grace period')) return msg; // already friendly
    return msg;
}
