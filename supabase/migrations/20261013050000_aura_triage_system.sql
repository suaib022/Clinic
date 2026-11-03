-- Migration: 20261013050000_aura_triage_system.sql
-- Description: Enterprise Aura AI Assistant triage intakes, file attachments, and prescription refill schema

-- 1. Triage Intakes Table
CREATE TABLE IF NOT EXISTS public.triage_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triage_ref TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    patient_name TEXT,
    patient_phone TEXT,
    patient_mrn TEXT,
    conversation_id TEXT,
    symptom_summary TEXT,
    severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'urgent', 'immediate_review')),
    duration_days INT DEFAULT 1,
    has_file_attachment BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'reviewed', 'escalated', 'resolved')),
    triage_protocol TEXT,
    escalated_to_nurse BOOLEAN DEFAULT false,
    nurse_urgency_reason TEXT,
    transcript JSONB DEFAULT '[]'::jsonb,
    raw_transcript TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'settled', 'failed')),
    synced_at TIMESTAMPTZ,
    doctor_notes TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Intake Attachments Table
CREATE TABLE IF NOT EXISTS public.intake_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id UUID REFERENCES public.triage_intakes(id) ON DELETE CASCADE,
    conversation_id TEXT,
    elevenlabs_file_id TEXT,
    filename TEXT NOT NULL,
    file_type TEXT,
    file_size INT,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'medical-records',
    public_url TEXT,
    signed_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Prescriptions / Refill Requests Table
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refill_id TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    patient_name TEXT,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    pharmacy_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ready', 'rejected')),
    estimated_ready_time TIMESTAMPTZ,
    conversation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_triage_intakes_ref ON public.triage_intakes(triage_ref);
CREATE INDEX IF NOT EXISTS idx_triage_intakes_conv_id ON public.triage_intakes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_triage_intakes_status ON public.triage_intakes(status);
CREATE INDEX IF NOT EXISTS idx_triage_intakes_severity ON public.triage_intakes(severity);
CREATE INDEX IF NOT EXISTS idx_triage_intakes_created_at ON public.triage_intakes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_attachments_intake_id ON public.intake_attachments(intake_id);
CREATE INDEX IF NOT EXISTS idx_intake_attachments_conv_id ON public.intake_attachments(conversation_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_refill_id ON public.prescriptions(refill_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);

-- RLS Policies
ALTER TABLE public.triage_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Service role full access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'triage_intakes' AND policyname = 'Allow service_role full access on triage_intakes') THEN
        CREATE POLICY "Allow service_role full access on triage_intakes" ON public.triage_intakes FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_attachments' AND policyname = 'Allow service_role full access on intake_attachments') THEN
        CREATE POLICY "Allow service_role full access on intake_attachments" ON public.intake_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prescriptions' AND policyname = 'Allow service_role full access on prescriptions') THEN
        CREATE POLICY "Allow service_role full access on prescriptions" ON public.prescriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- Authenticated staff & clinicians access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'triage_intakes' AND policyname = 'Staff can view and update triage_intakes') THEN
        CREATE POLICY "Staff can view and update triage_intakes" ON public.triage_intakes FOR ALL TO authenticated USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'doctor', 'compounder'))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_attachments' AND policyname = 'Staff can view intake_attachments') THEN
        CREATE POLICY "Staff can view intake_attachments" ON public.intake_attachments FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'doctor', 'compounder'))
        );
    END IF;
END $$;

