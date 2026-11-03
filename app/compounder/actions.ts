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

export async function startConsultation(appointmentId: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('start_consultation', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function endConsultation(appointmentId: string) {
    const { user } = await requireRole(['compounder', 'doctor', 'admin']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('end_consultation', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    revalidatePath('/compounder/bookings');
    revalidatePath('/doctor/appointments');
    return { success: true };
}

export async function completeConsultation(appointmentId: string) {
    const { user } = await requireRole(['compounder', 'doctor', 'admin']);
    const supabase = await createClient();
    const { error } = await supabase.rpc('complete_consultation', { p_id: appointmentId });
    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    revalidatePath('/compounder/bookings');
    revalidatePath('/doctor/appointments');
    return { success: true };
}

export async function uploadVisitPrescription(formData: FormData) {
    const { user } = await requireRole(['compounder', 'doctor', 'admin']);
    const appointmentId = formData.get('appointmentId') as string;
    const file = formData.get('file') as File;
    const notes = (formData.get('notes') as string) || '';

    if (!appointmentId) {
        return { success: false, error: 'Appointment ID is required' };
    }
    if (!file || file.size === 0) {
        return { success: false, error: 'Please select a prescription file to upload' };
    }

    try {
        // 1. Fetch appointment details
        const { data: appt, error: apptErr } = await supabaseAdmin
            .from('appointments')
            .select(`
                id,
                patient_id,
                doctor_id,
                appointment_date,
                status,
                serial_no,
                doctor:users!appointments_doctor_id_fkey(id, full_name),
                patient:patients!inner(id, full_name)
            `)
            .eq('id', appointmentId)
            .single();

        if (apptErr || !appt) {
            return { success: false, error: 'Appointment not found' };
        }

        // 2. Upload file to Supabase storage
        const fileExt = file.name.split('.').pop() || 'pdf';
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${appt.patient_id}/${Date.now()}-prescription-${cleanName}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: storageErr } = await supabaseAdmin.storage
            .from('medical_documents')
            .upload(fileName, buffer, {
                contentType: file.type || 'application/pdf',
                upsert: false
            });

        if (storageErr) {
            return { success: false, error: `Storage upload failed: ${storageErr.message}` };
        }

        // 3. Create medical_records entry
        const doctorName = (appt.doctor as any)?.full_name || 'Consultant';
        const { data: record, error: recordErr } = await supabaseAdmin
            .from('medical_records')
            .insert({
                patient_id: appt.patient_id,
                doctor_id: appt.doctor_id,
                appointment_id: appt.id,
                uploaded_by: user.id,
                record_type: 'prescription',
                title: `Prescription - Dr. ${doctorName} (${appt.appointment_date})`,
                description: notes.trim() || `Prescription uploaded for Serial #${appt.serial_no}`,
                file_path: fileName,
                document_date: appt.appointment_date,
                file_size: file.size,
                file_type: file.type || 'application/pdf'
            })
            .select()
            .single();

        if (recordErr || !record) {
            return { success: false, error: `Failed to save record metadata: ${recordErr?.message}` };
        }

        // 4. Update appointment to 'completed' with prescription_record_id via RPC
        const { error: rpcErr } = await supabaseAdmin.rpc('complete_prescription_upload', {
            p_appointment_id: appt.id,
            p_record_id: record.id
        });

        if (rpcErr) {
            return { success: false, error: `Failed to finalize appointment: ${rpcErr.message}` };
        }

        // 5. Revalidate paths
        revalidatePath('/compounder');
        revalidatePath('/compounder/bookings');
        revalidatePath('/doctor/appointments');
        revalidatePath('/patient/records');
        revalidatePath('/patient/appointments');
        revalidatePath('/patient/dashboard');

        return { 
            success: true, 
            recordId: record.id,
            message: `Prescription uploaded successfully. Serial #${appt.serial_no} is now marked Complete.` 
        };
    } catch (err: any) {
        return { success: false, error: err.message || 'Prescription upload failed' };
    }
}

// ──── CHAMBER SESSION ACTIONS ────

export async function startChamberSession(scheduledStart?: string, delayReason?: string, delayMinutes?: number) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    if (!compounder?.assigned_doctor_id) {
        return { success: false, error: 'No doctor assigned to this compounder account.' };
    }

    const { error } = await supabase.rpc('start_doctor_session', {
        p_doctor_id: compounder.assigned_doctor_id,
        p_scheduled_start: scheduledStart || null,
        p_delay_reason: delayReason || null,
        p_delay_minutes: delayMinutes ?? null
    });

    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function recordChamberDelay(delayMinutes: number, reason: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    if (!compounder?.assigned_doctor_id) {
        return { success: false, error: 'No doctor assigned.' };
    }

    const { error } = await supabase.rpc('record_doctor_delay', {
        p_doctor_id: compounder.assigned_doctor_id,
        p_delay_minutes: delayMinutes,
        p_reason: reason || 'Emergency / Routine Delay'
    });

    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function pauseChamberSession(reason: string) {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    if (!compounder?.assigned_doctor_id) return { success: false, error: 'No doctor assigned.' };

    const { error } = await supabase.rpc('pause_doctor_session', {
        p_doctor_id: compounder.assigned_doctor_id,
        p_reason: reason || 'Break'
    });

    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function resumeChamberSession() {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    if (!compounder?.assigned_doctor_id) return { success: false, error: 'No doctor assigned.' };

    const { error } = await supabase.rpc('resume_doctor_session', {
        p_doctor_id: compounder.assigned_doctor_id
    });

    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

export async function endChamberSession() {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();
    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    if (!compounder?.assigned_doctor_id) return { success: false, error: 'No doctor assigned.' };

    const { error } = await supabase.rpc('end_doctor_session', {
        p_doctor_id: compounder.assigned_doctor_id
    });

    if (error) return { success: false, error: friendlyError(error.message) };
    revalidatePath('/compounder');
    return { success: true };
}

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
    
    if (!/^\+8801[3-9]\d{8}$/.test(normalizedMobile)) {
        return { success: false, error: 'Please enter a valid Bangladeshi mobile number starting with +8801' };
    }
    
    // Check if mobile already exists
    const { data: existing } = await supabaseAdmin
        .from('patients')
        .select('id, full_name, uhid')
        .eq('mobile_no', normalizedMobile)
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
            mobile_no: normalizedMobile,
            gender,
            title,
            uhid: newUhid
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
    
    if (cleaned.startsWith('880') && cleaned.length === 13) {
        cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('01') && cleaned.length === 11) {
        cleaned = '+88' + cleaned;
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
