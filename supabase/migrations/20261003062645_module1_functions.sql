-- Migration: Create appointment lifecycle functions

-- Helper to check if doctor is on leave
CREATE OR REPLACE FUNCTION public.is_doctor_on_leave(p_doctor_id uuid, p_date date, p_time time) RETURNS boolean AS $$
DECLARE
  v_leave RECORD;
BEGIN
  FOR v_leave IN
    SELECT * FROM public.doctor_leave_requests
    WHERE doctor_id = p_doctor_id AND status = 'approved'
      AND start_date <= p_date AND end_date >= p_date
  LOOP
    IF v_leave.type = 'full_day' THEN
      RETURN true;
    ELSIF v_leave.type = 'partial_day' AND p_time >= v_leave.start_time AND p_time < v_leave.end_time THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper to check if time is during a break
CREATE OR REPLACE FUNCTION public.is_doctor_on_break(p_doctor_id uuid, p_day_of_week int, p_time time) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.doctor_schedule_breaks
    WHERE doctor_id = p_doctor_id AND day_of_week = p_day_of_week
      AND p_time >= start_time AND p_time < end_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- create_appointment
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_end_time time,
  p_serial_no int,
  p_scheduled_start timestamptz,
  p_slot_minutes int,
  p_visit_type text
) RETURNS public.appointments AS $$
DECLARE
  v_appt public.appointments;
  v_day_of_week int;
  v_schedule RECORD;
BEGIN
  -- Validate caller is service_role
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Must be called by service role';
  END IF;

  -- Validate Date not in past in Dhaka
  IF p_appointment_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date THEN
    RAISE EXCEPTION 'Cannot book appointments in the past';
  END IF;
  
  -- Acquire advisory xact lock
  PERFORM pg_advisory_xact_lock(
    hashtext(p_doctor_id::text),
    hashtext(p_appointment_date::text)
  );

  -- Validate Doctor Active
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_doctor_id AND role = 'doctor') THEN
    RAISE EXCEPTION 'Doctor not found or not active';
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_appointment_date);

  -- Validate Schedule
  SELECT * INTO v_schedule FROM public.doctor_schedules 
  WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor is not scheduled on this day';
  END IF;

  IF p_start_time < v_schedule.start_time OR p_end_time > v_schedule.end_time THEN
    RAISE EXCEPTION 'Slot is outside doctor schedule hours';
  END IF;

  IF public.is_doctor_on_break(p_doctor_id, v_day_of_week, p_start_time) THEN
    RAISE EXCEPTION 'Slot is during a break';
  END IF;

  IF public.is_doctor_on_leave(p_doctor_id, p_appointment_date, p_start_time) THEN
    RAISE EXCEPTION 'Doctor is on leave';
  END IF;
  
  -- Slot conflict check is handled by unique index idx_unique_active_slot, 
  -- but we can explicitly check to return a cleaner error.
  IF EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE doctor_id = p_doctor_id 
    AND appointment_date = p_appointment_date 
    AND start_time = p_start_time 
    AND status NOT IN ('cancelled', 'no_show')
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;
  
  INSERT INTO public.appointments (
    patient_id, doctor_id, appointment_date, start_time, end_time, 
    status, serial_no, scheduled_start, slot_minutes, visit_type
  ) VALUES (
    p_patient_id, p_doctor_id, p_appointment_date, p_start_time, p_end_time,
    'scheduled', p_serial_no, p_scheduled_start, p_slot_minutes, p_visit_type
  ) RETURNING * INTO v_appt;
  
  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_role
  ) VALUES (
    v_appt.id, p_doctor_id, 'created', NULL, 'scheduled', 'system'
  );
  
  RETURN v_appt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_appointment FROM public, anon, authenticated;


-- check_in_appointment
CREATE OR REPLACE FUNCTION public.check_in_appointment(p_id uuid) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  
  -- Role check: doctor (own), compounder (assigned), admin
  IF v_role = 'admin' THEN
    -- allowed
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
    -- allowed
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
    -- allowed
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  IF v_appt.appointment_date != (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date THEN
    RAISE EXCEPTION 'Can only check in on the day of the appointment';
  END IF;

  UPDATE public.appointments 
  SET status = 'checked_in', 
      checked_in_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role
  ) VALUES (
    p_id, v_appt.doctor_id, 'checked_in', v_appt.status, 'checked_in', auth.uid(), v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- start_consultation
CREATE OR REPLACE FUNCTION public.start_consultation(p_id uuid) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Ensure no other patient is in_consultation
  IF EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id = v_appt.doctor_id AND status = 'in_consultation') THEN
    RAISE EXCEPTION 'Doctor already has a patient in consultation';
  END IF;

  -- Auto-open doctor session if needed
  IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = v_appt.doctor_id AND session_date = v_appt.appointment_date AND status != 'ended') THEN
    INSERT INTO public.doctor_sessions (doctor_id, session_date, started_at) 
    VALUES (v_appt.doctor_id, v_appt.appointment_date, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka');
  END IF;

  UPDATE public.appointments 
  SET status = 'in_consultation', 
      consult_started_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role
  ) VALUES (
    p_id, v_appt.doctor_id, 'consultation_started', v_appt.status, 'in_consultation', auth.uid(), v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- complete_consultation
CREATE OR REPLACE FUNCTION public.complete_consultation(p_id uuid) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.appointments 
  SET status = 'completed', 
      consult_ended_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role
  ) VALUES (
    p_id, v_appt.doctor_id, 'consultation_completed', v_appt.status, 'completed', auth.uid(), v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- mark_no_show
CREATE OR REPLACE FUNCTION public.mark_no_show(p_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Rule: only after scheduled_start + 15 mins (unless admin)
  IF v_role != 'admin' AND v_appt.scheduled_start + interval '15 minutes' > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka') THEN
    RAISE EXCEPTION 'Cannot mark no_show until 15 minutes after scheduled start time';
  END IF;

  UPDATE public.appointments 
  SET status = 'no_show', 
      no_show_marked_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'no_show_marked', v_appt.status, 'no_show', auth.uid(), v_role, jsonb_build_object('reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- cancel_appointment
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'patient' AND public.is_patient_owner(v_appt.patient_id) THEN
    -- Patient specific rules
    IF v_appt.status != 'scheduled' THEN
      RAISE EXCEPTION 'Patients can only cancel scheduled appointments';
    END IF;
    IF v_appt.scheduled_start - interval '60 minutes' < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka') THEN
      RAISE EXCEPTION 'Patients cannot cancel within 60 minutes of the appointment';
    END IF;
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.appointments 
  SET status = 'cancelled', 
      cancelled_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      cancelled_by_role = v_role,
      cancel_reason = p_reason,
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'cancelled', v_appt.status, 'cancelled', auth.uid(), v_role, jsonb_build_object('reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- set_priority
CREATE OR REPLACE FUNCTION public.set_priority(p_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
  ELSE
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.appointments 
  SET is_priority = true, priority_reason = p_reason
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'priority_set', v_appt.status, v_appt.status, auth.uid(), v_role, jsonb_build_object('reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- admin_reopen_no_show
CREATE OR REPLACE FUNCTION public.admin_reopen_no_show(p_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_appt public.appointments;
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;

  UPDATE public.appointments 
  SET status = 'scheduled', 
      status_changed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka',
      status_changed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.queue_events (
    appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata
  ) VALUES (
    p_id, v_appt.doctor_id, 'reopened', v_appt.status, 'scheduled', auth.uid(), v_role, jsonb_build_object('reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke direct UPDATE of status/timestamps/serial columns from anon and authenticated
REVOKE UPDATE (status, checked_in_at, consult_started_at, consult_ended_at, cancelled_at, no_show_marked_at, serial_no) 
ON public.appointments FROM anon, authenticated;
