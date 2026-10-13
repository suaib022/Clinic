-- Migration: Decision Support System (DSS) - Queue Delay, Waiting Time Estimation & ML Analytics Logging

-- 1. Department/Speciality Consultation Benchmarks
CREATE TABLE IF NOT EXISTS public.department_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    speciality_name TEXT UNIQUE NOT NULL,
    avg_consult_minutes NUMERIC NOT NULL DEFAULT 10,
    min_consult_minutes NUMERIC NOT NULL DEFAULT 5,
    max_consult_minutes NUMERIC NOT NULL DEFAULT 25,
    safe_buffer_minutes NUMERIC NOT NULL DEFAULT 5,
    transition_buffer_seconds INT NOT NULL DEFAULT 90,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.department_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read department_benchmarks" ON public.department_benchmarks;
CREATE POLICY "Public read department_benchmarks" ON public.department_benchmarks FOR SELECT TO public USING (true);

-- Seed clinical consultation time benchmarks based on medical domain knowledge
INSERT INTO public.department_benchmarks (speciality_name, avg_consult_minutes, min_consult_minutes, max_consult_minutes, safe_buffer_minutes, transition_buffer_seconds, description)
VALUES
    ('DEFAULT', 10, 5, 20, 5, 90, 'General clinic consultation fallback'),
    ('ADMINISTRATION', 10, 5, 20, 5, 60, 'Administrative medical review'),
    ('BURN & PLASTIC SURGEON', 16, 8, 30, 6, 120, 'Burn evaluation, wound dressing assessment, cosmetic consultation'),
    ('CARDIAC SURGERY', 20, 10, 40, 8, 120, 'Post-op cardiac checkup, bypass/valve evaluation, surgical counseling'),
    ('CARDIOLOGY', 15, 7, 30, 5, 90, 'ECG/Echo evaluation, hypertensive medication adjustment, angina review'),
    ('CHEST & THORACIC SURGEON', 18, 8, 35, 6, 120, 'Pulmonary resection review, chest drain evaluation, thoracic oncology'),
    ('CHILD CARDIOLOGIST', 16, 8, 35, 6, 120, 'Congenital heart defect assessment, pediatric echo review'),
    ('CHILD NEUROLOGIST', 20, 10, 40, 7, 120, 'Epilepsy, cerebral palsy, developmental milestones assessment'),
    ('DENTAL SURGEON', 14, 6, 30, 5, 90, 'Oral examination, tooth extraction review, orthodontic planning'),
    ('DERMATOLOGY', 8, 4, 18, 4, 60, 'Skin lesion inspection, rash diagnosis, topical therapy adjustment'),
    ('DOCTOR ASSISTANT', 7, 3, 15, 3, 60, 'Preliminary vitals, screening triage'),
    ('EMERGENCY', 12, 5, 30, 5, 60, 'Acute triage and initial stabilization'),
    ('ENDOCRINOLOGY', 12, 6, 25, 5, 90, 'Hormonal disorders, pituitary and adrenal disease'),
    ('ENDOCRINOLOGY & DIABETOLOGY', 12, 6, 25, 5, 90, 'Insulin titration, glycemic control, diabetic neuropathy review'),
    ('ENT SPECIALIST', 8, 4, 18, 4, 60, 'Otoscopy, rhinoscopy, ear wax removal, sore throat examination'),
    ('Foetal medicine', 22, 10, 45, 8, 120, 'High-risk prenatal anomaly scans, fetal growth monitoring'),
    ('GASTROENTEROLOGY', 14, 6, 28, 5, 90, 'Endoscopy review, IBD management, peptic ulcer and reflux follow-up'),
    ('GENERAL & COLORECTUL SURGEON', 16, 8, 30, 6, 90, 'Hemorrhoid, fissure, colorectal screening and surgery follow-up'),
    ('GENERAL & LAPAROSCOPIC SURGERY', 15, 7, 30, 5, 90, 'Gallbladder, hernia, laparoscopic pre-op and post-op checks'),
    ('GENERAL SURGERY', 15, 7, 30, 5, 90, 'Surgical consultation, suture removal, wound healing assessment'),
    ('GYNAE & OBSTETRICS', 13, 6, 25, 5, 90, 'Antenatal care, ultrasound review, fertility and gynecological checkup'),
    ('HAEMATOLOGY', 18, 8, 35, 6, 120, 'Anemia workup, bleeding disorders, leukemia/lymphoma management'),
    ('HEALTH CARE', 10, 5, 20, 4, 60, 'General health check, screening wellness check'),
    ('HEPATIC SURGEON', 20, 10, 40, 8, 120, 'Liver resection, bile duct surgery follow-up'),
    ('HEPATOLOGIST', 15, 7, 30, 5, 90, 'Hepatitis B/C management, fatty liver, cirrhosis follow-up'),
    ('INTERNAL MEDICINE', 10, 5, 22, 4, 90, 'Multi-system disease investigation, chronic ailment management'),
    ('IT', 10, 5, 15, 3, 60, 'System check'),
    ('LAPAROSCOPIC COLORECTUL SURGEON', 18, 8, 35, 6, 120, 'Minimally invasive colorectal review'),
    ('MARKETING', 10, 5, 15, 3, 60, 'Administrative'),
    ('MEDICINE', 10, 5, 20, 4, 90, 'General consultation, fever workup, seasonal ailments'),
    ('MEDICINE & PULMONOLOGIST', 14, 6, 28, 5, 90, 'Asthma, COPD, spirometry review, tuberculosis follow-up'),
    ('MEDICINE & RHEUMATOLOGY', 16, 7, 32, 6, 90, 'Rheumatoid arthritis, lupus, autoimmune immunosuppressive review'),
    ('MEDICINE SPECIALIST', 10, 5, 20, 4, 90, 'Comprehensive adult medical evaluation'),
    ('NEPHROLOGY', 15, 7, 30, 5, 90, 'CKD staging, dialysis prescription, glomerulonephritis review'),
    ('NEURO SURGERY', 22, 10, 45, 8, 120, 'Spinal decompression, brain tumor post-op, MRI review'),
    ('NEUROLOGY', 18, 8, 35, 6, 120, 'Stroke follow-up, neuropathy, movement disorders, headache management'),
    ('NUTRITIONIST', 15, 7, 25, 5, 60, 'Diet chart planning, caloric calculation, lifestyle modification'),
    ('ONCOLOGY', 20, 10, 40, 8, 120, 'Chemotherapy review, staging scans, palliative counseling'),
    ('OPTHALMOLOGY', 10, 5, 20, 4, 60, 'Slit lamp examination, visual acuity, cataract pre-op'),
    ('ORTHOPEDIC SURGEON', 13, 6, 26, 5, 90, 'Fracture reduction review, joint replacement, X-ray evaluation'),
    ('ORTHOPEDICS', 12, 6, 25, 5, 90, 'Joint pain, arthritis, plaster removal, mobility assessment'),
    ('PAEDIATRIC SURGERY', 16, 7, 32, 6, 120, 'Pediatric congenital anomalies, hernia, post-surgical checks'),
    ('PAEDIATRICS', 8, 4, 18, 4, 60, 'Well-child visit, growth check, immunizations, acute illness'),
    ('PAIN MEDICINE', 16, 8, 30, 6, 90, 'Chronic pain assessment, nerve block evaluation'),
    ('Pediatric Gastroenterology', 15, 7, 30, 5, 90, 'Pediatric celiac, reflux, failure to thrive'),
    ('PEDIATRICS & NEONATOLOGIST', 10, 5, 22, 5, 90, 'NICU discharge follow-up, neonatal jaundice, newborn check'),
    ('PHYSICAL MEDICINE SPECIALIST', 14, 6, 26, 5, 90, 'Rehabilitation therapy plan, stroke rehab, musculoskeletal ergonomics'),
    ('PSYCHIATRY', 20, 10, 45, 8, 120, 'Depression, anxiety, psychotherapy, psychotropic adjustment'),
    ('RADIOLOGY & IMAGING', 10, 5, 20, 4, 60, 'Ultrasound scan, report explanation'),
    ('RHEUMATOLOGIST', 16, 7, 32, 6, 90, 'Biologics monitoring, joint swelling assessment'),
    ('THYROID SPECIALIST', 10, 5, 20, 4, 90, 'Hypo/hyperthyroidism, thyroid nodule fine needle review'),
    ('UROLOGY', 14, 6, 28, 5, 90, 'Kidney stones, BPH, urinary incontinence, ultrasound KUB review'),
    ('VASCULAR SURGEON', 18, 8, 35, 6, 120, 'Peripheral artery disease, varicose veins, Doppler review')
ON CONFLICT (speciality_name) DO UPDATE SET
    avg_consult_minutes = EXCLUDED.avg_consult_minutes,
    min_consult_minutes = EXCLUDED.min_consult_minutes,
    max_consult_minutes = EXCLUDED.max_consult_minutes,
    safe_buffer_minutes = EXCLUDED.safe_buffer_minutes,
    transition_buffer_seconds = EXCLUDED.transition_buffer_seconds,
    description = EXCLUDED.description;

-- 2. Add DSS Columns to doctor_sessions
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS scheduled_start TIME;
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS delay_minutes NUMERIC DEFAULT 0;
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS delay_reason TEXT;
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS delay_notified_at TIMESTAMPTZ;
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS started_by_user_id UUID REFERENCES public.users(id);

-- 3. Machine Learning & Operational Analytics Log Table
CREATE TABLE IF NOT EXISTS public.consultation_analytics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.doctor_sessions(id) ON DELETE SET NULL,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    speciality_name TEXT,
    serial_no INT,
    visit_type TEXT,
    visit_source TEXT,
    is_priority BOOLEAN DEFAULT false,
    scheduled_slot_time TIME,
    doctor_scheduled_start TIME,
    doctor_actual_start TIMESTAMPTZ,
    doctor_delay_minutes NUMERIC DEFAULT 0,
    checked_in_at TIMESTAMPTZ,
    consult_started_at TIMESTAMPTZ,
    consult_ended_at TIMESTAMPTZ,
    consult_duration_minutes NUMERIC,
    transition_gap_seconds NUMERIC,
    wait_time_minutes NUMERIC,
    patients_ahead_total INT,
    patients_ahead_present INT,
    predicted_wait_minutes NUMERIC,
    predicted_consult_minutes NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_analytics_doc ON public.consultation_analytics_logs(doctor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_analytics_spec ON public.consultation_analytics_logs(speciality_name, created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_analytics_appt ON public.consultation_analytics_logs(appointment_id);

ALTER TABLE public.consultation_analytics_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and Admin can view consultation analytics" ON public.consultation_analytics_logs;
CREATE POLICY "Staff and Admin can view consultation analytics" ON public.consultation_analytics_logs 
FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
    OR (public.get_user_role() = 'compounder' AND doctor_id = public.compounder_doctor_id(auth.uid()))
);

-- 4. Update Session Functions to Allow Compounders and Track Chamber Start Delay
CREATE OR REPLACE FUNCTION public.start_doctor_session(
    p_doctor_id UUID,
    p_scheduled_start TIME DEFAULT NULL,
    p_delay_reason TEXT DEFAULT NULL,
    p_delay_minutes NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_role TEXT;
    v_doc_id UUID;
    v_session_id UUID;
    v_now TIMESTAMPTZ;
    v_today DATE;
    v_sched_start TIME;
    v_computed_delay NUMERIC;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        v_role := 'admin';
    ELSE
        v_role := public.get_user_role();
    END IF;

    IF v_role = 'admin' THEN
        v_doc_id := p_doctor_id;
    ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
        v_doc_id := p_doctor_id;
    ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = p_doctor_id THEN
        v_doc_id := p_doctor_id;
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;

    v_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';
    v_today := v_now::date;

    -- Lookup scheduled start time if not provided
    v_sched_start := p_scheduled_start;
    IF v_sched_start IS NULL THEN
        SELECT start_time INTO v_sched_start FROM public.doctor_schedules 
        WHERE doctor_id = v_doc_id AND day_of_week = EXTRACT(DOW FROM v_today) AND is_active = true
        LIMIT 1;
    END IF;

    -- Calculate delay if scheduled start is known
    v_computed_delay := COALESCE(p_delay_minutes, 0);
    IF v_computed_delay = 0 AND v_sched_start IS NOT NULL THEN
        IF v_now::time > v_sched_start THEN
            v_computed_delay := ROUND(EXTRACT(EPOCH FROM (v_now::time - v_sched_start)) / 60);
        END IF;
    END IF;

    -- If active session exists, update it to open
    SELECT id INTO v_session_id FROM public.doctor_sessions 
    WHERE doctor_id = v_doc_id AND session_date = v_today AND status != 'ended'
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
        UPDATE public.doctor_sessions 
        SET status = 'open',
            scheduled_start = COALESCE(scheduled_start, v_sched_start),
            delay_minutes = GREATEST(delay_minutes, v_computed_delay),
            delay_reason = COALESCE(p_delay_reason, delay_reason)
        WHERE id = v_session_id;
    ELSE
        INSERT INTO public.doctor_sessions (
            doctor_id, session_date, started_at, status, scheduled_start, delay_minutes, delay_reason, started_by_user_id
        ) VALUES (
            v_doc_id, v_today, v_now, 'open', v_sched_start, v_computed_delay, p_delay_reason, auth.uid()
        ) RETURNING id INTO v_session_id;
    END IF;

    -- Log queue event
    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        gen_random_uuid(), v_doc_id, 'chamber_started', 'not_started', 'open', auth.uid(), v_role,
        jsonb_build_object(
            'session_id', v_session_id,
            'scheduled_start', v_sched_start,
            'actual_start', v_now,
            'delay_minutes', v_computed_delay,
            'delay_reason', p_delay_reason
        )
    );

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to record delay in advance (e.g. Doctor calls in saying delayed by 30 mins)
CREATE OR REPLACE FUNCTION public.record_doctor_delay(
    p_doctor_id UUID,
    p_delay_minutes NUMERIC,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_role TEXT;
    v_doc_id UUID;
    v_today DATE;
    v_now TIMESTAMPTZ;
    v_session_id UUID;
    v_sched_start TIME;
BEGIN
    v_role := public.get_user_role();
    IF v_role = 'admin' THEN
        v_doc_id := p_doctor_id;
    ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
        v_doc_id := p_doctor_id;
    ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = p_doctor_id THEN
        v_doc_id := p_doctor_id;
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;

    v_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';
    v_today := v_now::date;

    SELECT start_time INTO v_sched_start FROM public.doctor_schedules 
    WHERE doctor_id = v_doc_id AND day_of_week = EXTRACT(DOW FROM v_today) AND is_active = true
    LIMIT 1;

    SELECT id INTO v_session_id FROM public.doctor_sessions 
    WHERE doctor_id = v_doc_id AND session_date = v_today AND status != 'ended'
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
        UPDATE public.doctor_sessions 
        SET delay_minutes = p_delay_minutes,
            delay_reason = p_reason,
            delay_notified_at = v_now,
            scheduled_start = COALESCE(scheduled_start, v_sched_start)
        WHERE id = v_session_id;
    ELSE
        INSERT INTO public.doctor_sessions (
            doctor_id, session_date, started_at, status, scheduled_start, delay_minutes, delay_reason, delay_notified_at, started_by_user_id
        ) VALUES (
            v_doc_id, v_today, v_now, 'open', v_sched_start, p_delay_minutes, p_reason, v_now, auth.uid()
        );
    END IF;

    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        gen_random_uuid(), v_doc_id, 'chamber_delay_announced', NULL, NULL, auth.uid(), v_role,
        jsonb_build_object(
            'delay_minutes', p_delay_minutes,
            'reason', p_reason,
            'notified_at', v_now
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Update pause, resume, end session to allow compounder
CREATE OR REPLACE FUNCTION public.pause_doctor_session(p_doctor_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = p_doctor_id THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'No open session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'paused' WHERE id = v_session_id;
  INSERT INTO public.doctor_session_pauses (session_id, paused_at, reason) VALUES (v_session_id, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resume_doctor_session(p_doctor_id uuid) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = p_doctor_id THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status = 'paused';
  IF NOT FOUND THEN RAISE EXCEPTION 'No paused session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'open' WHERE id = v_session_id;
  UPDATE public.doctor_session_pauses SET resumed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE session_id = v_session_id AND resumed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.end_doctor_session(p_doctor_id uuid) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = p_doctor_id THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status != 'ended';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE id = v_session_id;
  UPDATE public.doctor_session_pauses SET resumed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE session_id = v_session_id AND resumed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Update start_consultation to allow compounder
CREATE OR REPLACE FUNCTION public.start_consultation(p_id uuid) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
  v_now timestamptz;
  v_session_id uuid;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    v_role := 'admin';
  ELSE
    v_role := public.get_user_role();
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Ensure no other patient is currently in_consultation
  IF EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id = v_appt.doctor_id AND status = 'in_consultation' AND id != p_id) THEN
    RAISE EXCEPTION 'Doctor already has a patient in consultation. Complete the current visit first.';
  END IF;

  v_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';

  -- Auto-open doctor session if needed
  IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = v_appt.doctor_id AND session_date = v_appt.appointment_date AND status != 'ended') THEN
    INSERT INTO public.doctor_sessions (doctor_id, session_date, started_at, status, started_by_user_id) 
    VALUES (v_appt.doctor_id, v_appt.appointment_date, v_now, 'open', auth.uid())
    RETURNING id INTO v_session_id;
  ELSE
    SELECT id INTO v_session_id FROM public.doctor_sessions 
    WHERE doctor_id = v_appt.doctor_id AND session_date = v_appt.appointment_date AND status != 'ended'
    LIMIT 1;
  END IF;

  UPDATE public.appointments 
  SET status = 'in_consultation', 
      consult_started_at = v_now,
      status_changed_at = v_now,
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'consultation_started', v_appt.status, 'in_consultation', auth.uid(), v_role,
    jsonb_build_object('serial_no', v_appt.serial_no, 'session_id', v_session_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Update complete_consultation to allow compounder AND automatically record ML analytics log
CREATE OR REPLACE FUNCTION public.complete_consultation(p_id uuid) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
  v_now timestamptz;
  v_session public.doctor_sessions;
  v_spec_name text;
  v_prev_ended_at timestamptz;
  v_duration_min numeric;
  v_gap_sec numeric;
  v_wait_min numeric;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    v_role := 'admin';
  ELSE
    v_role := public.get_user_role();
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';

  UPDATE public.appointments 
  SET status = 'completed', 
      consult_ended_at = v_now,
      status_changed_at = v_now,
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'consultation_completed', v_appt.status, 'completed', auth.uid(), v_role,
    jsonb_build_object('serial_no', v_appt.serial_no)
  );

  -- Fetch session information
  SELECT * INTO v_session FROM public.doctor_sessions 
  WHERE doctor_id = v_appt.doctor_id AND session_date = v_appt.appointment_date AND status != 'ended'
  ORDER BY created_at DESC LIMIT 1;

  -- Fetch primary speciality
  SELECT s.name INTO v_spec_name 
  FROM public.doctor_specialities ds 
  JOIN public.specialities s ON ds.speciality_id = s.id 
  WHERE ds.doctor_id = v_appt.doctor_id 
  LIMIT 1;

  -- Find previous completed patient today to calculate transition gap
  SELECT consult_ended_at INTO v_prev_ended_at
  FROM public.appointments
  WHERE doctor_id = v_appt.doctor_id 
    AND appointment_date = v_appt.appointment_date 
    AND status = 'completed'
    AND id != p_id
    AND consult_ended_at IS NOT NULL
  ORDER BY consult_ended_at DESC 
  LIMIT 1;

  -- Calculate metrics
  IF v_appt.consult_started_at IS NOT NULL THEN
      v_duration_min := ROUND(EXTRACT(EPOCH FROM (v_now - v_appt.consult_started_at)) / 60, 2);
  ELSE
      v_duration_min := 10;
  END IF;

  IF v_prev_ended_at IS NOT NULL AND v_appt.consult_started_at IS NOT NULL AND v_appt.consult_started_at >= v_prev_ended_at THEN
      v_gap_sec := ROUND(EXTRACT(EPOCH FROM (v_appt.consult_started_at - v_prev_ended_at)));
  ELSE
      v_gap_sec := 0;
  END IF;

  IF v_appt.checked_in_at IS NOT NULL AND v_appt.consult_started_at IS NOT NULL THEN
      v_wait_min := ROUND(EXTRACT(EPOCH FROM (v_appt.consult_started_at - v_appt.checked_in_at)) / 60, 2);
  ELSE
      v_wait_min := 0;
  END IF;

  -- Log into ML dataset table
  INSERT INTO public.consultation_analytics_logs (
      session_id,
      appointment_id,
      doctor_id,
      patient_id,
      speciality_name,
      serial_no,
      visit_type,
      visit_source,
      is_priority,
      scheduled_slot_time,
      doctor_scheduled_start,
      doctor_actual_start,
      doctor_delay_minutes,
      checked_in_at,
      consult_started_at,
      consult_ended_at,
      consult_duration_minutes,
      transition_gap_seconds,
      wait_time_minutes
  ) VALUES (
      v_session.id,
      p_id,
      v_appt.doctor_id,
      v_appt.patient_id,
      COALESCE(v_spec_name, 'DEFAULT'),
      v_appt.serial_no,
      v_appt.visit_type,
      v_appt.visit_source,
      v_appt.is_priority,
      v_appt.start_time,
      v_session.scheduled_start,
      v_session.started_at,
      COALESCE(v_session.delay_minutes, 0),
      v_appt.checked_in_at,
      v_appt.consult_started_at,
      v_now,
      v_duration_min,
      v_gap_sec,
      v_wait_min
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
