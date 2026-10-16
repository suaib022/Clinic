-- Migration: 20261013020000_prescription_workflow.sql
-- Enables two-stage consultation completion:
-- 1. Consultation Ends -> Room freed for next serial, Status becomes 'prescription_pending'
-- 2. Prescription Uploaded by Compounder -> Status becomes 'completed' and prescription is immediately available in Patient Portal

-- 1. Update Status Constraint
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('hold', 'scheduled', 'checked_in', 'in_consultation', 'prescription_pending', 'completed', 'cancelled', 'no_show'));

-- 2. Update Timestamp Constraint
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS chk_status_timestamps;
ALTER TABLE public.appointments ADD CONSTRAINT chk_status_timestamps 
CHECK (
  (status NOT IN ('completed', 'prescription_pending') OR (consult_started_at IS NOT NULL AND consult_ended_at IS NOT NULL))
);

-- 3. Add prescription reference column
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS prescription_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;

-- 4. Update Status Transition Trigger Function
CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_role text;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    SELECT (auth.jwt() ->> 'role')::text INTO v_role;
    IF v_role IS NULL OR v_role = 'authenticated' THEN
        SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    END IF;

    IF v_role = 'admin' THEN
        RETURN NEW;
    END IF;
    
    -- Check valid transitions
    IF OLD.status = 'hold' AND NEW.status NOT IN ('scheduled', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from hold to %', NEW.status;
    ELSIF OLD.status = 'scheduled' AND NEW.status NOT IN ('checked_in', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION 'Invalid transition from scheduled to %', NEW.status;
    ELSIF OLD.status = 'checked_in' AND NEW.status NOT IN ('in_consultation', 'no_show', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from checked_in to %', NEW.status;
    ELSIF OLD.status = 'in_consultation' AND NEW.status NOT IN ('prescription_pending', 'completed') THEN
        RAISE EXCEPTION 'Invalid transition from in_consultation to %', NEW.status;
    ELSIF OLD.status = 'prescription_pending' AND NEW.status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Invalid transition from prescription_pending to %', NEW.status;
    ELSIF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Status % is final and cannot be changed.', OLD.status;
    ELSIF OLD.status = 'no_show' AND NEW.status != 'scheduled' THEN
        RAISE EXCEPTION 'no_show can only be reverted to scheduled.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to End Consultation (Sets prescription_pending, frees chamber, records ML analytics)
CREATE OR REPLACE FUNCTION public.end_consultation(p_id uuid) RETURNS void AS $$
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

  IF v_appt.status != 'in_consultation' THEN
    RAISE EXCEPTION 'Appointment is not in consultation';
  END IF;

  v_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka';

  UPDATE public.appointments 
  SET status = 'prescription_pending', 
      consult_ended_at = v_now,
      status_changed_at = v_now,
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'consultation_ended', v_appt.status, 'prescription_pending', auth.uid(), v_role,
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

  -- Find previous completed / ended patient today to calculate transition gap
  SELECT consult_ended_at INTO v_prev_ended_at
  FROM public.appointments
  WHERE doctor_id = v_appt.doctor_id 
    AND appointment_date = v_appt.appointment_date 
    AND (status IN ('completed', 'prescription_pending'))
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

  -- Log into ML analytics table (if not already logged for this appointment)
  IF NOT EXISTS (SELECT 1 FROM public.consultation_analytics_logs WHERE appointment_id = p_id) THEN
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Function to Complete Prescription Upload and Finalize Visit
CREATE OR REPLACE FUNCTION public.complete_prescription_upload(
    p_appointment_id uuid,
    p_record_id uuid
) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
  v_now timestamptz;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    v_role := 'admin';
  ELSE
    v_role := public.get_user_role();
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
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
      prescription_record_id = p_record_id,
      status_changed_at = v_now,
      status_changed_by = auth.uid()
  WHERE id = p_appointment_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_appointment_id, v_appt.doctor_id, 'prescription_uploaded', v_appt.status, 'completed', auth.uid(), v_role,
    jsonb_build_object('serial_no', v_appt.serial_no, 'prescription_record_id', p_record_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Update complete_consultation to also handle transitioning from prescription_pending to completed
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
      consult_ended_at = COALESCE(consult_ended_at, v_now),
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

  -- Log into ML analytics table if not yet present
  IF NOT EXISTS (SELECT 1 FROM public.consultation_analytics_logs WHERE appointment_id = p_id) THEN
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.end_consultation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_prescription_upload(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_consultation(uuid) TO authenticated, service_role;
