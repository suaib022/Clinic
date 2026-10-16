-- Migration: 20261013040000_doctor_schedule_cancellation.sql
-- Description: Doctor single/multi-day schedule cancellation, patient notifications, refund and rebooking system

-- 1. Add refund_status to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'not_applicable';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_refund_status'
    ) THEN
        ALTER TABLE public.appointments 
        ADD CONSTRAINT chk_refund_status 
        CHECK (refund_status IN ('not_applicable', 'eligible', 'requested', 'processed', 'rebooked'));
    END IF;
END $$;

-- 2. Create patient_notifications table
CREATE TABLE IF NOT EXISTS public.patient_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_notif_patient_id ON public.patient_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notif_is_read ON public.patient_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_patient_notif_created_at ON public.patient_notifications(created_at);

-- 3. Enable RLS on patient_notifications
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;

-- Patients can view their notifications
DROP POLICY IF EXISTS "Patients can view their notifications" ON public.patient_notifications;
CREATE POLICY "Patients can view their notifications"
    ON public.patient_notifications
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
        )
    );

-- Patients can update is_read status
DROP POLICY IF EXISTS "Patients can update their notification read status" ON public.patient_notifications;
CREATE POLICY "Patients can update their notification read status"
    ON public.patient_notifications
    FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        patient_id IN (
            SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
        )
    );

-- Staff/Admins/Service_role can manage notifications
DROP POLICY IF EXISTS "Staff and admin full access to notifications" ON public.patient_notifications;
CREATE POLICY "Staff and admin full access to notifications"
    ON public.patient_notifications
    FOR ALL
    USING (
        public.get_user_role() IN ('admin', 'doctor', 'compounder') 
        OR current_setting('role', true) = 'service_role'
    );

-- 4. Postgres RPC: doctor_cancel_schedule
CREATE OR REPLACE FUNCTION public.doctor_cancel_schedule(
    p_start_date DATE,
    p_end_date DATE,
    p_reason TEXT,
    p_doctor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_doctor_id UUID;
    v_doctor_name TEXT;
    v_role TEXT;
    v_appt RECORD;
    v_cancelled_count INT := 0;
    v_refund_count INT := 0;
    v_patient_count INT := 0;
    v_affected_patient_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        v_role := 'admin';
    ELSE
        v_role := public.get_user_role();
    END IF;

    -- Validate permissions
    IF v_role NOT IN ('doctor', 'admin') THEN
        RAISE EXCEPTION 'Permission denied: Only doctors or admins can cancel schedules.';
    END IF;

    -- Doctor resolution: if admin or service_role, allow specifying p_doctor_id; otherwise auth.uid()
    IF p_doctor_id IS NOT NULL AND (v_role = 'admin' OR p_doctor_id = auth.uid()) THEN
        v_doctor_id := p_doctor_id;
    ELSE
        v_doctor_id := auth.uid();
    END IF;

    IF v_doctor_id IS NULL THEN
        RAISE EXCEPTION 'Doctor ID is required.';
    END IF;

    -- Validation of dates
    IF p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Start date (%) cannot be after end date (%).', p_start_date, p_end_date;
    END IF;

    IF p_end_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot cancel past schedules (end date is in the past).';
    END IF;

    IF NULLIF(TRIM(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A valid cancellation reason is required.';
    END IF;

    -- Get doctor name
    SELECT full_name INTO v_doctor_name FROM public.users WHERE id = v_doctor_id;
    IF v_doctor_name IS NULL THEN
        v_doctor_name := 'Doctor';
    END IF;

    -- Iterate through all active appointments on the given dates
    FOR v_appt IN 
        SELECT 
            id, 
            patient_id, 
            serial_no, 
            appointment_date, 
            payment_status, 
            paid_amount
        FROM public.appointments
        WHERE doctor_id = v_doctor_id
          AND appointment_date BETWEEN p_start_date AND p_end_date
          AND status IN ('scheduled', 'checked_in', 'hold')
        FOR UPDATE
    LOOP
        v_cancelled_count := v_cancelled_count + 1;
        
        -- Track unique patients
        IF NOT (v_appt.patient_id = ANY(v_affected_patient_ids)) THEN
            v_affected_patient_ids := array_append(v_affected_patient_ids, v_appt.patient_id);
            v_patient_count := v_patient_count + 1;
        END IF;

        -- Check refund eligibility
        IF v_appt.payment_status = 'paid' AND COALESCE(v_appt.paid_amount, 0) > 0 THEN
            v_refund_count := v_refund_count + 1;

            UPDATE public.appointments
            SET status = 'cancelled',
                cancelled_at = now(),
                cancelled_by_role = 'doctor',
                cancel_reason = p_reason,
                refund_status = 'eligible',
                status_changed_at = now(),
                status_changed_by = v_doctor_id
            WHERE id = v_appt.id;
        ELSE
            UPDATE public.appointments
            SET status = 'cancelled',
                cancelled_at = now(),
                cancelled_by_role = 'doctor',
                cancel_reason = p_reason,
                refund_status = 'not_applicable',
                status_changed_at = now(),
                status_changed_by = v_doctor_id
            WHERE id = v_appt.id;
        END IF;

        -- Log in queue_events
        INSERT INTO public.queue_events (
            appointment_id,
            doctor_id,
            event_type,
            from_status,
            to_status,
            actor_user_id,
            actor_role,
            metadata
        ) VALUES (
            v_appt.id,
            v_doctor_id,
            'cancelled_by_doctor',
            'scheduled',
            'cancelled',
            v_doctor_id,
            v_role,
            jsonb_build_object(
                'reason', p_reason,
                'cancelled_date', v_appt.appointment_date,
                'serial_no', v_appt.serial_no
            )
        );

        -- Insert notification to patient
        INSERT INTO public.patient_notifications (
            patient_id,
            appointment_id,
            type,
            title,
            message,
            action_url,
            metadata
        ) VALUES (
            v_appt.patient_id,
            v_appt.id,
            'doctor_cancellation',
            'Appointment Cancelled: Dr. ' || v_doctor_name,
            'Your appointment on ' || to_char(v_appt.appointment_date, 'DD Mon YYYY') || 
            ' (Serial #' || v_appt.serial_no || ') with Dr. ' || v_doctor_name || 
            ' was cancelled due to: ' || p_reason || '. ' ||
            CASE 
                WHEN v_appt.payment_status = 'paid' THEN 'You can claim a full refund or rebook for an upcoming day.'
                ELSE 'You can rebook another doctor or select an upcoming date.'
            END,
            '/patient/appointments',
            jsonb_build_object(
                'doctor_id', v_doctor_id,
                'doctor_name', v_doctor_name,
                'appointment_date', v_appt.appointment_date,
                'serial_no', v_appt.serial_no,
                'reason', p_reason,
                'refund_eligible', (v_appt.payment_status = 'paid' AND COALESCE(v_appt.paid_amount, 0) > 0),
                'paid_amount', COALESCE(v_appt.paid_amount, 0)
            )
        );
    END LOOP;

    -- Close any open doctor sessions for these dates
    UPDATE public.doctor_sessions
    SET status = 'ended',
        ended_at = now()
    WHERE doctor_id = v_doctor_id
      AND session_date BETWEEN p_start_date AND p_end_date
      AND status != 'ended';

    -- Record approved leave in doctor_leave_requests so slots are closed
    INSERT INTO public.doctor_leave_requests (
        doctor_id,
        type,
        start_date,
        end_date,
        reason,
        status,
        reviewed_at,
        created_at
    ) VALUES (
        v_doctor_id,
        'full_day',
        p_start_date,
        p_end_date,
        'Schedule Cancelled: ' || p_reason,
        'approved',
        now(),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'cancelled_appointments_count', v_cancelled_count,
        'affected_patients_count', v_patient_count,
        'refund_eligible_count', v_refund_count,
        'start_date', p_start_date,
        'end_date', p_end_date,
        'reason', p_reason
    );
END;
$function$;

-- 5. Postgres RPC: process_patient_refund
CREATE OR REPLACE FUNCTION public.process_patient_refund(
    p_appointment_id UUID,
    p_refund_reason TEXT DEFAULT 'Doctor schedule cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_appt public.appointments;
    v_user_role TEXT;
    v_caller_uid UUID;
    v_refund_amount NUMERIC;
BEGIN
    v_caller_uid := auth.uid();
    IF current_setting('role', true) = 'service_role' THEN
        v_user_role := 'admin';
    ELSE
        v_user_role := public.get_user_role();
    END IF;

    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    -- Validate ownership if patient
    IF v_user_role != 'admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.patients 
            WHERE id = v_appt.patient_id AND auth_user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Permission denied: This appointment does not belong to your account.';
        END IF;
    END IF;

    -- Validate refund eligibility
    IF v_appt.refund_status != 'eligible' THEN
        IF v_appt.refund_status = 'processed' THEN
            RAISE EXCEPTION 'Refund has already been processed for this appointment.';
        ELSIF v_appt.refund_status = 'rebooked' THEN
            RAISE EXCEPTION 'This appointment fee was already transferred to a rebooked visit.';
        ELSE
            RAISE EXCEPTION 'This appointment is not eligible for refund (current refund status: %).', v_appt.refund_status;
        END IF;
    END IF;

    v_refund_amount := COALESCE(v_appt.paid_amount, 0);

    -- Mark refund as processed
    UPDATE public.appointments
    SET refund_status = 'processed',
        payment_status = 'refunded',
        status_changed_at = now(),
        status_changed_by = v_caller_uid
    WHERE id = p_appointment_id;

    -- Update payments table if record exists
    UPDATE public.payments
    SET status = 'refunded',
        updated_at = now()
    WHERE appointment_id = p_appointment_id;

    -- Send confirmation notification
    INSERT INTO public.patient_notifications (
        patient_id,
        appointment_id,
        type,
        title,
        message,
        action_url,
        metadata
    ) VALUES (
        v_appt.patient_id,
        v_appt.id,
        'refund_processed',
        'Refund Processed: BDT ' || v_refund_amount,
        'Your refund of BDT ' || v_refund_amount || ' for appointment serial #' || v_appt.serial_no || ' on ' || to_char(v_appt.appointment_date, 'DD Mon YYYY') || ' has been processed successfully.',
        '/patient/appointments',
        jsonb_build_object(
            'refunded_amount', v_refund_amount,
            'refund_date', now(),
            'reason', p_refund_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'refunded_amount', v_refund_amount,
        'status', 'processed'
    );
END;
$function$;

-- 6. Postgres RPC: rebook_cancelled_appointment
CREATE OR REPLACE FUNCTION public.rebook_cancelled_appointment(
    p_old_appointment_id UUID,
    p_new_doctor_id UUID,
    p_new_date DATE,
    p_new_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_appt public.appointments;
    v_user_role TEXT;
    v_caller_uid UUID;
    v_new_serial INT;
    v_new_appt_id UUID;
    v_doctor_name TEXT;
    v_is_paid_transfer BOOLEAN := false;
BEGIN
    v_caller_uid := auth.uid();
    IF current_setting('role', true) = 'service_role' THEN
        v_user_role := 'admin';
    ELSE
        v_user_role := public.get_user_role();
    END IF;

    SELECT * INTO v_old_appt FROM public.appointments WHERE id = p_old_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original appointment not found';
    END IF;

    -- Validate ownership if patient
    IF v_user_role != 'admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.patients 
            WHERE id = v_old_appt.patient_id AND auth_user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Permission denied: This appointment does not belong to your account.';
        END IF;
    END IF;

    IF v_old_appt.status != 'cancelled' THEN
        RAISE EXCEPTION 'Only cancelled appointments can be rebooked.';
    END IF;

    IF v_old_appt.refund_status = 'rebooked' THEN
        RAISE EXCEPTION 'This cancelled appointment has already been rebooked.';
    END IF;

    IF p_new_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot book an appointment in the past.';
    END IF;

    -- Check if doctor is unavailable / on leave on new date
    IF EXISTS (
        SELECT 1 FROM public.doctor_leave_requests 
        WHERE doctor_id = p_new_doctor_id 
          AND status = 'approved' 
          AND p_new_date BETWEEN start_date AND end_date
    ) THEN
        RAISE EXCEPTION 'Doctor is unavailable on the selected date. Please choose another date.';
    END IF;

    -- Fetch next serial number for doctor on new date
    SELECT COALESCE(MAX(serial_no), 0) + 1 INTO v_new_serial
    FROM public.appointments
    WHERE doctor_id = p_new_doctor_id
      AND appointment_date = p_new_date;

    -- Check if fee transfer applies
    IF v_old_appt.payment_status = 'paid' AND v_old_appt.refund_status = 'eligible' AND COALESCE(v_old_appt.paid_amount, 0) > 0 THEN
        v_is_paid_transfer := true;
    END IF;

    -- Create new appointment
    INSERT INTO public.appointments (
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        serial_no,
        status,
        visit_type,
        visit_source,
        payment_status,
        paid_amount,
        refund_status,
        created_by_user_id
    ) VALUES (
        v_old_appt.patient_id,
        p_new_doctor_id,
        p_new_date,
        p_new_time,
        (p_new_time + interval '15 minutes')::time,
        v_new_serial,
        'scheduled',
        v_old_appt.visit_type,
        'online',
        CASE WHEN v_is_paid_transfer THEN 'paid' ELSE 'unpaid' END,
        CASE WHEN v_is_paid_transfer THEN v_old_appt.paid_amount ELSE 0.00 END,
        'not_applicable',
        v_caller_uid
    )
    RETURNING id INTO v_new_appt_id;

    -- Mark old appointment as rebooked so fee cannot be double-refunded
    UPDATE public.appointments
    SET refund_status = 'rebooked'
    WHERE id = p_old_appointment_id;

    -- Get doctor name
    SELECT full_name INTO v_doctor_name FROM public.users WHERE id = p_new_doctor_id;

    -- Send confirmation notification
    INSERT INTO public.patient_notifications (
        patient_id,
        appointment_id,
        type,
        title,
        message,
        action_url,
        metadata
    ) VALUES (
        v_old_appt.patient_id,
        v_new_appt_id,
        'rebooked',
        'Rebooking Confirmed: Dr. ' || COALESCE(v_doctor_name, 'Doctor'),
        'Your appointment has been successfully rebooked for ' || to_char(p_new_date, 'DD Mon YYYY') || ' at ' || p_new_time || ' (Serial #' || v_new_serial || '). ' ||
        CASE WHEN v_is_paid_transfer THEN 'Your previous visit fee (BDT ' || v_old_appt.paid_amount || ') was transferred.' ELSE '' END,
        '/patient/appointments',
        jsonb_build_object(
            'old_appointment_id', p_old_appointment_id,
            'new_appointment_id', v_new_appt_id,
            'serial_no', v_new_serial,
            'fee_transferred', v_is_paid_transfer
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_appointment_id', v_new_appt_id,
        'serial_no', v_new_serial,
        'doctor_name', v_doctor_name,
        'date', p_new_date,
        'fee_transferred', v_is_paid_transfer
    );
END;
$function$;
