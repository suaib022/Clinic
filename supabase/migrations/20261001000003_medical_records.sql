-- Migration: 20261001000003_medical_records.sql
-- Goal: Medical records, documents tables, storage buckets, and policies

-- 1. Create medical_records table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Could be doctor, compounder, or admin
    record_type TEXT NOT NULL CHECK (record_type IN ('prescription', 'test_report', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL, -- Path in Supabase storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Storage Bucket setup (Assuming Supabase Storage is enabled)
-- Insert bucket if it doesn't exist. This requires the storage schema which is usually present in Supabase.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical_documents', 'medical_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS for medical_records table
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Patients can view their own records (if they are authenticated via our custom api, they'll bypass RLS using service_role or we create a specific policy if using postgrest, but since they use custom auth via Next.js API, the API uses service_role key to fetch on their behalf. So we don't strictly need RLS for custom next.js API if it uses the service_role key. However, for doctors logging in via Supabase Auth:)

-- Doctors can see records of patients they have appointments with
CREATE POLICY "Doctors can view their patients records" 
ON public.medical_records FOR SELECT 
USING (
    auth.uid() = doctor_id
);

-- Doctors can insert records for their patients
CREATE POLICY "Doctors can insert records" 
ON public.medical_records FOR INSERT 
WITH CHECK (
    auth.uid() = doctor_id
);

-- Compounders can see and insert records for their assigned doctor
CREATE POLICY "Compounders can view assigned doctor patient records"
ON public.medical_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.compounders 
        WHERE id = auth.uid() AND assigned_doctor_id = public.medical_records.doctor_id
    )
);

CREATE POLICY "Compounders can insert records"
ON public.medical_records FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.compounders 
        WHERE id = auth.uid() AND assigned_doctor_id = public.medical_records.doctor_id
    )
);

-- Admins can do everything
CREATE POLICY "Admins full access on records"
ON public.medical_records FOR ALL
USING (public.is_admin(auth.uid()));

-- Storage Policies for 'medical_documents' bucket
-- These apply if clients upload directly. If Next.js API uploads, it uses service_role.
-- Assuming doctors/compounders upload directly via supabase-js:
CREATE POLICY "Doctors can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'medical_documents' AND 
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('doctor', 'compounder', 'admin')))
);

CREATE POLICY "Doctors can read files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'medical_documents' AND 
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('doctor', 'compounder', 'admin')))
);

-- Rollback (Commented)
/*
DROP POLICY IF EXISTS "Doctors can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can read files" ON storage.objects;
DROP TABLE IF EXISTS public.medical_records CASCADE;
*/
