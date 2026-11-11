-- Migration: Record extraction (Phase 1)
-- Structured data extracted from uploaded prescriptions and test reports.
-- Every extracted row references its source document (record_id) with ON DELETE CASCADE,
-- so deleting a medical_records row removes all data derived from it.
-- Extracted tables hold only patient_id (UUID); no names, phones or other personal info.

-- 1. Extraction status on medical_records (doubles as the job queue)
ALTER TABLE public.medical_records
    ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS extraction_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extraction_error TEXT,
    ADD COLUMN IF NOT EXISTS extraction_model TEXT,
    ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS file_hash TEXT;

ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_extraction_status_check;
ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_extraction_status_check
    CHECK (extraction_status IN ('none', 'pending', 'processing', 'done', 'failed'));

CREATE INDEX IF NOT EXISTS idx_medical_records_extraction_queue
    ON public.medical_records (created_at)
    WHERE extraction_status IN ('pending', 'failed');

-- New prescriptions and test reports are queued automatically, whatever the insert path.
CREATE OR REPLACE FUNCTION public.queue_record_extraction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.record_type IN ('prescription', 'test_report') THEN
        NEW.extraction_status := 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_queue_record_extraction ON public.medical_records;
CREATE TRIGGER trg_queue_record_extraction
    BEFORE INSERT ON public.medical_records
    FOR EACH ROW EXECUTE FUNCTION public.queue_record_extraction();

-- 2. Raw model output per document (kept for re-parsing without re-calling the model)
CREATE TABLE IF NOT EXISTS public.record_extractions (
    record_id UUID PRIMARY KEY REFERENCES public.medical_records(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    raw JSONB NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Medicines from prescriptions
CREATE TABLE IF NOT EXISTS public.rx_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    drug_name TEXT NOT NULL,
    generic_name TEXT,
    strength TEXT,
    form TEXT,
    dose TEXT,
    frequency TEXT,
    duration TEXT,
    route TEXT,
    instructions TEXT,
    prescribed_on DATE,
    confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Doctor notes from prescriptions
CREATE TABLE IF NOT EXISTS public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    note_type TEXT NOT NULL CHECK (note_type IN
        ('complaint', 'diagnosis', 'finding', 'vital', 'advice', 'investigation', 'follow_up', 'allergy', 'other')),
    content TEXT NOT NULL,
    noted_on DATE,
    confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Lab values from test reports
CREATE TABLE IF NOT EXISTS public.lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    test_name TEXT,
    analyte TEXT NOT NULL,
    value_num NUMERIC,
    value_text TEXT,
    unit TEXT,
    ref_low NUMERIC,
    ref_high NUMERIC,
    ref_text TEXT,
    flag TEXT CHECK (flag IN ('low', 'normal', 'high', 'critical', 'abnormal')),
    sample_date DATE,
    confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Report-level summary for test reports
CREATE TABLE IF NOT EXISTS public.report_insights (
    record_id UUID PRIMARY KEY REFERENCES public.medical_records(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    summary TEXT,
    abnormal_findings TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rx_medications_patient ON public.rx_medications (patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_medications_record ON public.rx_medications (record_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON public.clinical_notes (patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_record ON public.clinical_notes (record_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_analyte ON public.lab_results (patient_id, analyte, sample_date);
CREATE INDEX IF NOT EXISTS idx_lab_results_record ON public.lab_results (record_id);

-- 7. RLS: read-only for the patient owner, their doctors and admins.
-- Writes happen only from the server with the service role key (bypasses RLS).
ALTER TABLE public.record_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rx_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_insights ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['record_extractions', 'rx_medications', 'clinical_notes', 'lab_results', 'report_insights']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Extracted data read access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Extracted data read access" ON public.%I FOR SELECT TO authenticated USING (
                public.is_patient_owner(patient_id)
                OR public.get_user_role() = ''admin''
                OR (public.get_user_role() = ''doctor'' AND public.is_doctor_of_patient(patient_id))
            )', t);
    END LOOP;
END $$;
