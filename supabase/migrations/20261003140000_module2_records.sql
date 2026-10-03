-- Migration: Module 2 - Records Vault
-- Adds document_date, appointment_id, file_size, file_type to medical_records
-- Adjusts doctor_id to be nullable for general documents
-- Creates access_log table
-- Creates helpers for staff_patient_basic, doctor_has_patient, compounder_has_patient

-- 1. Modify medical_records table
ALTER TABLE public.medical_records 
    ADD COLUMN IF NOT EXISTS document_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date NOT NULL,
    ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS file_size INTEGER,
    ADD COLUMN IF NOT EXISTS file_type TEXT,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    ALTER COLUMN doctor_id DROP NOT NULL;

-- 2. Update record_type constraint
ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_record_type_check;
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_record_type_check 
    CHECK (record_type IN ('prescription', 'test_report', 'imaging', 'discharge_summary', 'other'));

-- 3. Access log
CREATE TABLE IF NOT EXISTS public.medical_records_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.medical_records_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access logs"
ON public.medical_records_access_log FOR SELECT
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Patients can view their own access logs"
ON public.medical_records_access_log FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = medical_records_access_log.patient_id AND auth_user_id = auth.uid())
);

-- 4. Helpers for access checks
CREATE OR REPLACE FUNCTION public.doctor_has_patient(p_doctor_id UUID, p_patient_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = p_doctor_id
          AND patient_id = p_patient_id
          AND status != 'cancelled'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.compounder_has_patient(p_compounder_id UUID, p_patient_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_doctor_id UUID;
BEGIN
    SELECT assigned_doctor_id INTO v_doctor_id FROM public.compounders WHERE id = p_compounder_id;
    IF v_doctor_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = v_doctor_id
          AND patient_id = p_patient_id
          AND status != 'cancelled'
          AND appointment_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date - INTERVAL '1 day'
          AND appointment_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Update RLS policies for medical_records
DROP POLICY IF EXISTS "Doctors can view their patients records" ON public.medical_records;
DROP POLICY IF EXISTS "Doctors can insert records" ON public.medical_records;
DROP POLICY IF EXISTS "Compounders can view assigned doctor patient records" ON public.medical_records;
DROP POLICY IF EXISTS "Compounders can insert records" ON public.medical_records;
DROP POLICY IF EXISTS "Admins full access on records" ON public.medical_records;

-- Admin Policy
CREATE POLICY "Admins full access on records"
ON public.medical_records FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Patient Policies
CREATE POLICY "Patients can view their own records"
ON public.medical_records FOR SELECT
USING (
    is_deleted = FALSE AND
    EXISTS (SELECT 1 FROM public.patients WHERE id = medical_records.patient_id AND auth_user_id = auth.uid())
);

CREATE POLICY "Patients can insert their own records"
ON public.medical_records FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients WHERE id = medical_records.patient_id AND auth_user_id = auth.uid())
);

CREATE POLICY "Patients can soft-delete their own self-uploaded records"
ON public.medical_records FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = medical_records.patient_id AND auth_user_id = auth.uid())
    AND uploaded_by = auth.uid()
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.patients WHERE id = medical_records.patient_id AND auth_user_id = auth.uid())
    AND uploaded_by = auth.uid()
);

-- Doctor Policies
CREATE POLICY "Doctors can view records of their patients"
ON public.medical_records FOR SELECT
USING (
    is_deleted = FALSE AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'doctor') AND
    public.doctor_has_patient(auth.uid(), patient_id)
);

CREATE POLICY "Doctors can insert records for their patients"
ON public.medical_records FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'doctor') AND
    public.doctor_has_patient(auth.uid(), patient_id)
);

-- Compounder Policies (Write-Only)
CREATE POLICY "Compounders can insert records for eligible patients"
ON public.medical_records FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'compounder') AND
    public.compounder_has_patient(auth.uid(), patient_id)
);

-- Compounders can UPDATE records (only retract their own within 15 mins)
CREATE POLICY "Compounders can retract their recent uploads"
ON public.medical_records FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'compounder') AND
    uploaded_by = auth.uid() AND
    created_at >= NOW() - INTERVAL '15 minutes'
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'compounder') AND
    uploaded_by = auth.uid() AND
    created_at >= NOW() - INTERVAL '15 minutes'
);

-- 6. Compounder uploads RPC (SECURITY DEFINER to hide full records from compounders)
CREATE OR REPLACE FUNCTION public.get_recent_compounder_uploads()
RETURNS TABLE (
    id UUID,
    patient_name TEXT,
    uhid TEXT,
    record_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        mr.id,
        p.full_name as patient_name,
        p.uhid,
        mr.record_type,
        mr.created_at
    FROM public.medical_records mr
    JOIN public.patients p ON mr.patient_id = p.id
    WHERE mr.uploaded_by = auth.uid()
      AND mr.created_at >= NOW() - INTERVAL '24 hours'
      AND mr.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Log access RPC
CREATE OR REPLACE FUNCTION public.log_patient_access(p_patient_id UUID, p_action TEXT)
RETURNS VOID AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    IF v_role IS NOT NULL THEN
        INSERT INTO public.medical_records_access_log (patient_id, accessed_by, role, action)
        VALUES (p_patient_id, auth.uid(), v_role, p_action);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
