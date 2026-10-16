-- Migration: 20261013030000_appointment_feedbacks.sql
-- Description: Patient visit feedback and rating system with 7-day expiration and audit metadata

-- 1. Create appointment_feedbacks table
CREATE TABLE IF NOT EXISTS public.appointment_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_rating INTEGER NOT NULL CHECK (doctor_rating BETWEEN 1 AND 5),
    service_rating INTEGER NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
    overall_rating NUMERIC(3, 2) GENERATED ALWAYS AS (ROUND((doctor_rating + service_rating) / 2.0, 2)) STORED,
    comment TEXT,
    visit_date DATE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_appointment_feedback UNIQUE (appointment_id)
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_feedbacks_doctor_id ON public.appointment_feedbacks(doctor_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_patient_id ON public.appointment_feedbacks(patient_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_visit_date ON public.appointment_feedbacks(visit_date);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.appointment_feedbacks(created_at);

-- 3. Enable RLS
ALTER TABLE public.appointment_feedbacks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow patients to view feedback they submitted
CREATE POLICY "Patients can view their own feedbacks"
    ON public.appointment_feedbacks
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
        )
    );

-- Allow doctors to view feedback for their visits
CREATE POLICY "Doctors can view feedbacks for their consultations"
    ON public.appointment_feedbacks
    FOR SELECT
    USING (
        doctor_id = auth.uid()
    );

-- Allow staff/admin to view all feedback
CREATE POLICY "Admins can view all feedbacks"
    ON public.appointment_feedbacks
    FOR ALL
    USING (
        public.get_user_role() = 'admin' OR current_setting('role', true) = 'service_role'
    );

-- 5. Postgres RPC to submit feedback with strict validation & 7-day expiration
CREATE OR REPLACE FUNCTION public.submit_appointment_feedback(
    p_appointment_id UUID,
    p_doctor_rating INTEGER,
    p_service_rating INTEGER,
    p_comment TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_appt public.appointments;
    v_feedback_id UUID;
    v_user_role TEXT;
    v_caller_uid UUID;
    v_days_elapsed INTEGER;
BEGIN
    v_caller_uid := auth.uid();
    IF current_setting('role', true) = 'service_role' THEN
        v_user_role := 'admin';
    ELSE
        v_user_role := public.get_user_role();
    END IF;

    -- Fetch appointment
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    -- Validate ownership (if not admin/service_role)
    IF v_user_role != 'admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.patients 
            WHERE id = v_appt.patient_id AND auth_user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Permission denied: This appointment does not belong to your account.';
        END IF;
    END IF;

    -- Validate visit status: must be completed
    IF v_appt.status != 'completed' THEN
        RAISE EXCEPTION 'Feedback can only be submitted for completed visits (current status: %).', v_appt.status;
    END IF;

    -- Validate 7-day expiration:
    -- Cannot submit if more than 7 days have passed since the visit date
    v_days_elapsed := (CURRENT_DATE - v_appt.appointment_date);
    IF v_days_elapsed > 7 THEN
        RAISE EXCEPTION 'Feedback window expired. Feedback can only be submitted within 7 days of the visit (visit was % days ago).', v_days_elapsed;
    END IF;

    -- Validate ratings
    IF p_doctor_rating < 1 OR p_doctor_rating > 5 THEN
        RAISE EXCEPTION 'Doctor rating must be between 1 and 5 stars';
    END IF;

    IF p_service_rating < 1 OR p_service_rating > 5 THEN
        RAISE EXCEPTION 'Service quality rating must be between 1 and 5 stars';
    END IF;

    -- Check if feedback already submitted
    IF EXISTS (SELECT 1 FROM public.appointment_feedbacks WHERE appointment_id = p_appointment_id) THEN
        RAISE EXCEPTION 'Feedback has already been submitted for this visit.';
    END IF;

    -- Insert feedback
    INSERT INTO public.appointment_feedbacks (
        appointment_id,
        patient_id,
        doctor_id,
        doctor_rating,
        service_rating,
        comment,
        visit_date,
        metadata
    ) VALUES (
        p_appointment_id,
        v_appt.patient_id,
        v_appt.doctor_id,
        p_doctor_rating,
        p_service_rating,
        NULLIF(TRIM(p_comment), ''),
        v_appt.appointment_date,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_feedback_id;

    RETURN v_feedback_id;
END;
$function$;
