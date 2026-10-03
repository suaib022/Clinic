-- Module 4: Compounder Portal Data Model

-- 1. Add columns to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS visit_source TEXT DEFAULT 'online' CHECK (visit_source IN ('online', 'walk_in'));
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Backfill existing appointments to 'online'
UPDATE public.appointments SET visit_source = 'online' WHERE visit_source IS NULL;

-- 3. Modify unique index for active slots to apply only to 'online'
DROP INDEX IF EXISTS idx_unique_active_slot;
CREATE UNIQUE INDEX idx_unique_active_slot ON public.appointments(doctor_id, appointment_date, start_time) 
WHERE status != 'cancelled' AND visit_source = 'online';

-- 4. Create walk_in_requests table for idempotency
CREATE TABLE IF NOT EXISTS public.walk_in_requests (
    compounder_id UUID NOT NULL REFERENCES public.compounders(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(compounder_id, idempotency_key)
);
ALTER TABLE public.walk_in_requests ENABLE ROW LEVEL SECURITY;

-- 5. Create staff_lookup_log table for rate limiting and logging
CREATE TABLE IF NOT EXISTS public.staff_lookup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compounder_id UUID NOT NULL REFERENCES public.compounders(id) ON DELETE CASCADE,
    lookup_time TIMESTAMPTZ DEFAULT NOW(),
    result_count INT NOT NULL,
    query_hash TEXT NOT NULL
);
ALTER TABLE public.staff_lookup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read staff_lookup_log" ON public.staff_lookup_log FOR SELECT USING (is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_walk_in_requests_compounder ON public.walk_in_requests(compounder_id);
CREATE INDEX IF NOT EXISTS idx_staff_lookup_log_compounder_time ON public.staff_lookup_log(compounder_id, lookup_time);

-- 6. Update enforce_status_transition to allow checked_in -> scheduled (undo)
CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Check valid transitions
    IF OLD.status = 'hold' AND NEW.status NOT IN ('scheduled', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from hold to %', NEW.status;
    ELSIF OLD.status = 'scheduled' AND NEW.status NOT IN ('checked_in', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION 'Invalid transition from scheduled to %', NEW.status;
    ELSIF OLD.status = 'checked_in' AND NEW.status NOT IN ('in_consultation', 'no_show', 'cancelled', 'scheduled') THEN
        RAISE EXCEPTION 'Invalid transition from checked_in to %', NEW.status;
    ELSIF OLD.status = 'in_consultation' AND NEW.status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Invalid transition from in_consultation to %', NEW.status;
    ELSIF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Status % is final and cannot be changed.', OLD.status;
    ELSIF OLD.status = 'no_show' AND NEW.status != 'scheduled' THEN
        RAISE EXCEPTION 'no_show can only be reverted to scheduled.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. SECURITY DEFINER Functions

-- Helper for getting compounder's assigned doctor
CREATE OR REPLACE FUNCTION public.compounder_doctor_id(c_id UUID)
RETURNS UUID AS $$
DECLARE
    v_doc_id UUID;
BEGIN
    SELECT assigned_doctor_id INTO v_doc_id FROM public.compounders WHERE id = c_id;
    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check In
CREATE OR REPLACE FUNCTION public.check_in_appointment(p_id UUID) RETURNS VOID AS $$
DECLARE
    v_appt public.appointments;
    v_role TEXT;
    v_doc UUID;
BEGIN
    v_role := public.get_user_role();
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
    
    IF v_role = 'compounder' THEN
        v_doc := public.compounder_doctor_id(auth.uid());
        IF v_doc != v_appt.doctor_id THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;
    ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
    ELSIF v_role = 'admin' THEN
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    IF v_appt.status != 'scheduled' THEN
        RAISE EXCEPTION 'Appointment is not scheduled';
    END IF;
    IF v_appt.appointment_date != (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date THEN
        RAISE EXCEPTION 'Can only check in appointments for today';
    END IF;
    
    UPDATE public.appointments 
    SET status = 'checked_in', 
        checked_in_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
        status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
        status_changed_by = auth.uid()
    WHERE id = p_id;

    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        p_id, v_appt.doctor_id, 'checked_in', v_appt.status, 'checked_in', auth.uid(), v_role, '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Undo Check In
CREATE OR REPLACE FUNCTION public.undo_check_in(p_id UUID) RETURNS VOID AS $$
DECLARE
    v_appt public.appointments;
    v_role TEXT;
    v_doc UUID;
    v_minutes INT;
BEGIN
    v_role := public.get_user_role();
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
    
    IF v_role = 'compounder' THEN
        v_doc := public.compounder_doctor_id(auth.uid());
        IF v_doc != v_appt.doctor_id THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;
        IF v_appt.status_changed_by != auth.uid() THEN
            RAISE EXCEPTION 'Only the compounder who checked in can undo it';
        END IF;
    ELSIF v_role = 'admin' THEN
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    IF v_appt.status != 'checked_in' THEN
        RAISE EXCEPTION 'Appointment is not checked in';
    END IF;
    
    v_minutes := EXTRACT(EPOCH FROM ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka') - v_appt.checked_in_at)) / 60;
    IF v_role = 'compounder' AND v_minutes > 5 THEN
        RAISE EXCEPTION 'Undo time window (5 minutes) has expired';
    END IF;
    
    UPDATE public.appointments 
    SET status = 'scheduled', 
        checked_in_at = NULL,
        status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
        status_changed_by = auth.uid()
    WHERE id = p_id;

    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        p_id, v_appt.doctor_id, 'undo_check_in', 'checked_in', 'scheduled', auth.uid(), v_role, '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Retract Walk-In
CREATE OR REPLACE FUNCTION public.retract_walk_in(p_id UUID) RETURNS VOID AS $$
DECLARE
    v_appt public.appointments;
    v_role TEXT;
    v_doc UUID;
    v_minutes INT;
BEGIN
    v_role := public.get_user_role();
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
    
    IF v_role = 'compounder' THEN
        v_doc := public.compounder_doctor_id(auth.uid());
        IF v_doc != v_appt.doctor_id THEN
            RAISE EXCEPTION 'Permission denied';
        END IF;
        IF v_appt.created_by_user_id != auth.uid() THEN
            RAISE EXCEPTION 'Only the compounder who created the walk-in can retract it';
        END IF;
    ELSIF v_role = 'admin' THEN
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    IF v_appt.visit_source != 'walk_in' THEN
        RAISE EXCEPTION 'Cannot retract online bookings';
    END IF;
    
    IF v_appt.status != 'checked_in' THEN
        RAISE EXCEPTION 'Walk-in is no longer in checked_in state';
    END IF;
    
    v_minutes := EXTRACT(EPOCH FROM ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka') - v_appt.created_at)) / 60;
    IF v_role = 'compounder' AND v_minutes > 5 THEN
        RAISE EXCEPTION 'Retract time window (5 minutes) has expired';
    END IF;
    
    UPDATE public.appointments 
    SET status = 'cancelled', 
        cancelled_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
        cancelled_by_role = v_role,
        cancel_reason = 'created_in_error',
        status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
        status_changed_by = auth.uid()
    WHERE id = p_id;

    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        p_id, v_appt.doctor_id, 'retract_walk_in', 'checked_in', 'cancelled', auth.uid(), v_role, '{"reason": "created_in_error"}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create Walk-In Appointment
CREATE OR REPLACE FUNCTION public.create_walk_in_appointment(
    p_patient_id UUID,
    p_visit_type TEXT,
    p_is_priority BOOLEAN,
    p_priority_reason TEXT,
    p_idempotency_key TEXT
) RETURNS UUID AS $$
DECLARE
    v_role TEXT;
    v_doc_id UUID;
    v_day_of_week INT;
    v_appt_date DATE;
    v_current_time TIME;
    v_existing_id UUID;
    v_max_serial INT;
    v_new_id UUID;
BEGIN
    v_role := public.get_user_role();
    IF v_role != 'compounder' THEN
        RAISE EXCEPTION 'Only compounders can create walk-ins';
    END IF;
    
    v_doc_id := public.compounder_doctor_id(auth.uid());
    IF v_doc_id IS NULL THEN
        RAISE EXCEPTION 'Compounder has no assigned doctor';
    END IF;
    
    -- Check Idempotency
    SELECT appointment_id INTO v_existing_id FROM public.walk_in_requests 
    WHERE compounder_id = auth.uid() AND idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;
    
    v_appt_date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date;
    v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::time;
    v_day_of_week := EXTRACT(DOW FROM v_appt_date);
    
    -- Validate Patient
    IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = p_patient_id AND is_active = true) THEN
        RAISE EXCEPTION 'Patient not found or archived';
    END IF;
    
    -- Validate No existing active appointment today
    IF EXISTS (
        SELECT 1 FROM public.appointments 
        WHERE patient_id = p_patient_id AND doctor_id = v_doc_id 
        AND appointment_date = v_appt_date AND status NOT IN ('cancelled', 'completed')
    ) THEN
        RAISE EXCEPTION 'Patient already has an active appointment with this doctor today';
    END IF;
    
    -- Validate Doctor Schedule
    IF NOT EXISTS (
        SELECT 1 FROM public.doctor_schedules 
        WHERE doctor_id = v_doc_id AND day_of_week = v_day_of_week AND is_active = true
        AND v_current_time >= start_time AND v_current_time <= end_time
    ) THEN
        RAISE EXCEPTION 'Outside doctor working hours';
    END IF;
    
    -- Validate Leave
    IF public.is_doctor_on_leave(v_doc_id, v_appt_date, v_current_time) THEN
        RAISE EXCEPTION 'Doctor is on leave';
    END IF;
    
    -- Note: Break time allows creation with warning (warning handled in UI)
    
    -- Get next serial
    PERFORM pg_advisory_xact_lock(hashtext(v_doc_id::text), hashtext(v_appt_date::text));
    SELECT COALESCE(MAX(serial_no), 0) INTO v_max_serial FROM public.appointments 
    WHERE doctor_id = v_doc_id AND appointment_date = v_appt_date;
    
    v_new_id := gen_random_uuid();
    
    INSERT INTO public.appointments (
        id, patient_id, doctor_id, appointment_date, start_time, end_time, 
        status, serial_no, scheduled_start, visit_type, is_priority, priority_reason, 
        visit_source, created_by_user_id, checked_in_at, status_changed_by
    ) VALUES (
        v_new_id, p_patient_id, v_doc_id, v_appt_date, v_current_time, v_current_time + interval '15 minutes',
        'checked_in', v_max_serial + 1, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka', p_visit_type, p_is_priority, p_priority_reason,
        'walk_in', auth.uid(), CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka', auth.uid()
    );
    
    INSERT INTO public.walk_in_requests (compounder_id, idempotency_key, appointment_id)
    VALUES (auth.uid(), p_idempotency_key, v_new_id);
    
    INSERT INTO public.queue_events (
        appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
    ) VALUES (
        v_new_id, v_doc_id, 'walk_in_created', 'scheduled', 'checked_in', auth.uid(), v_role, '{}'::jsonb
    );
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Lookup Patient for Walk-In
CREATE OR REPLACE FUNCTION public.lookup_patient_for_walk_in(p_query TEXT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    uhid TEXT,
    gender TEXT
) AS $$
DECLARE
    v_role TEXT;
    v_hash TEXT;
    v_count INT;
    v_rate_limit_count INT;
BEGIN
    v_role := public.get_user_role();
    IF v_role != 'compounder' THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    -- Rate limit: 30 lookups per 15 mins
    SELECT COUNT(*) INTO v_rate_limit_count FROM public.staff_lookup_log 
    WHERE compounder_id = auth.uid() AND lookup_time >= NOW() - INTERVAL '15 minutes';
    
    IF v_rate_limit_count >= 30 THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
    END IF;
    
    v_hash := encode(digest(p_query, 'sha256'), 'hex');
    
    RETURN QUERY
    SELECT p.id, p.full_name, p.uhid, p.gender FROM public.patients p
    WHERE p.is_active = true 
    AND (p.uhid = p_query OR p.mobile = p_query OR p.mobile = '+88' || p_query OR p.mobile = '+880' || substring(p_query from 2))
    LIMIT 5;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    INSERT INTO public.staff_lookup_log (compounder_id, result_count, query_hash)
    VALUES (auth.uid(), v_count, v_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
