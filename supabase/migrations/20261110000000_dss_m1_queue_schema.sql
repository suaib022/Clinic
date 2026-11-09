-- DSS-M1: Live queue schema + queue action functions.
-- Additive and safe to re-run. See docs/dss-audit.md for the reasoning behind each change.

------------------------------------------------------------------------------
-- 0. Fix: legacy RPCs store Dhaka wall-clock time into timestamptz (6h shift).
--    Pinning their TimeZone to Asia/Dhaka makes `CURRENT_TIMESTAMP AT TIME ZONE
--    'Asia/Dhaka'` cast back to the correct instant, without rewriting bodies.
------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc ILIKE '%AT TIME ZONE ''Asia/Dhaka''%'
      -- queue/appointment lifecycle only; payment, refund and rebook functions are deliberately untouched
      AND p.proname IN ('check_in_appointment', 'undo_check_in', 'retract_walk_in', 'start_consultation',
                        'end_consultation', 'complete_consultation', 'complete_prescription_upload',
                        'cancel_appointment', 'admin_reopen_no_show', 'start_doctor_session',
                        'pause_doctor_session', 'resume_doctor_session', 'end_doctor_session', 'record_doctor_delay')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET timezone TO %L', r.sig, 'Asia/Dhaka');
  END LOOP;
END $$;

-- The 1-arg overload makes `rpc('start_doctor_session', {p_doctor_id})` ambiguous.
DROP FUNCTION IF EXISTS public.start_doctor_session(uuid);

------------------------------------------------------------------------------
-- 1. Columns (DSS-10, DSS-11, DSS-12)
------------------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS called_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS priority_level smallint NOT NULL DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS skipped_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS rejoined_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_priority_level_check CHECK (priority_level BETWEEN 0 AND 2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.appointments SET priority_level = 1 WHERE is_priority AND priority_level = 0;

ALTER TABLE public.queue_events ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE public.queue_events ADD COLUMN IF NOT EXISTS request_key text;
ALTER TABLE public.queue_events ADD COLUMN IF NOT EXISTS session_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_events_actor_request
  ON public.queue_events (actor_user_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_events_appt_time ON public.queue_events (appointment_id, occurred_at);

ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS scheduled_end time;
ALTER TABLE public.doctor_sessions ADD COLUMN IF NOT EXISTS slot_minutes int;

-- Session events used to insert a random uuid as appointment_id (FK violation).
CREATE OR REPLACE FUNCTION public.dss_queue_events_orphan_fix() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.appointment_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = NEW.appointment_id) THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('orphan_appointment_id', NEW.appointment_id);
    NEW.appointment_id := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_queue_events_orphan_fix ON public.queue_events;
CREATE TRIGGER trg_queue_events_orphan_fix BEFORE INSERT ON public.queue_events
FOR EACH ROW EXECUTE FUNCTION public.dss_queue_events_orphan_fix();

-- DSS-14 indexes
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_serial ON public.appointments (doctor_id, appointment_date, serial_no);
CREATE INDEX IF NOT EXISTS idx_cal_doctor_type_ended ON public.consultation_analytics_logs (doctor_id, visit_type, consult_ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_sessions_doctor_date ON public.doctor_sessions (doctor_id, session_date);
CREATE INDEX IF NOT EXISTS idx_session_pauses_session ON public.doctor_session_pauses (session_id);

------------------------------------------------------------------------------
-- 2. Compounder ↔ doctor assignments (one or more doctors per compounder)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compounder_doctors (
  compounder_id uuid NOT NULL REFERENCES public.compounders(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (compounder_id, doctor_id)
);
ALTER TABLE public.compounder_doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compounder_doctors read" ON public.compounder_doctors;
CREATE POLICY "compounder_doctors read" ON public.compounder_doctors FOR SELECT TO authenticated
USING (compounder_id = auth.uid() OR doctor_id = auth.uid() OR public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "compounder_doctors admin write" ON public.compounder_doctors;
CREATE POLICY "compounder_doctors admin write" ON public.compounder_doctors FOR ALL TO authenticated
USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

INSERT INTO public.compounder_doctors (compounder_id, doctor_id)
SELECT id, assigned_doctor_id FROM public.compounders WHERE assigned_doctor_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.dss_sync_compounder_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.assigned_doctor_id IS DISTINCT FROM NEW.assigned_doctor_id AND OLD.assigned_doctor_id IS NOT NULL THEN
    DELETE FROM public.compounder_doctors WHERE compounder_id = NEW.id AND doctor_id = OLD.assigned_doctor_id;
  END IF;
  IF NEW.assigned_doctor_id IS NOT NULL THEN
    INSERT INTO public.compounder_doctors (compounder_id, doctor_id) VALUES (NEW.id, NEW.assigned_doctor_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_compounder_assignment ON public.compounders;
CREATE TRIGGER trg_sync_compounder_assignment AFTER INSERT OR UPDATE OF assigned_doctor_id ON public.compounders
FOR EACH ROW EXECUTE FUNCTION public.dss_sync_compounder_assignment();

-- Module 4 helper, now aware of the doctor chosen in a DSS call (set only by dss_* after their own check).
CREATE OR REPLACE FUNCTION public.compounder_doctor_id(c_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ctx uuid := NULLIF(current_setting('dss.doctor_id', true), '')::uuid;
BEGIN
  IF v_ctx IS NOT NULL AND EXISTS (SELECT 1 FROM public.compounder_doctors WHERE compounder_id = c_id AND doctor_id = v_ctx) THEN
    RETURN v_ctx;
  END IF;
  RETURN (SELECT assigned_doctor_id FROM public.compounders WHERE id = c_id);
END $$;

CREATE OR REPLACE FUNCTION public.dss_can_manage(p_doctor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.get_user_role()
    WHEN 'admin' THEN true
    WHEN 'doctor' THEN p_doctor = auth.uid()
    WHEN 'compounder' THEN EXISTS (SELECT 1 FROM public.compounder_doctors WHERE compounder_id = auth.uid() AND doctor_id = p_doctor)
    ELSE false END
$$;

------------------------------------------------------------------------------
-- 3. Settings (DSS-13)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dss_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  on_time_band_min int NOT NULL DEFAULT 5 CHECK (on_time_band_min BETWEEN 0 AND 60),
  late_band_min int NOT NULL DEFAULT 15 CHECK (late_band_min BETWEEN 1 AND 180),
  grace_min int NOT NULL DEFAULT 10 CHECK (grace_min BETWEEN 0 AND 120),
  no_show_min int NOT NULL DEFAULT 30 CHECK (no_show_min BETWEEN 1 AND 240),
  doctor_late_alert_min int NOT NULL DEFAULT 20 CHECK (doctor_late_alert_min BETWEEN 1 AND 240),
  near_turn_count int NOT NULL DEFAULT 3 CHECK (near_turn_count BETWEEN 1 AND 20),
  undo_window_sec int NOT NULL DEFAULT 120 CHECK (undo_window_sec BETWEEN 10 AND 900),
  min_duration_samples int NOT NULL DEFAULT 10 CHECK (min_duration_samples BETWEEN 1 AND 30),
  default_slot_min int NOT NULL DEFAULT 10 CHECK (default_slot_min BETWEEN 1 AND 120),
  duration_clamp_min int NOT NULL DEFAULT 3 CHECK (duration_clamp_min BETWEEN 1 AND 60),
  duration_clamp_max int NOT NULL DEFAULT 60 CHECK (duration_clamp_max BETWEEN 5 AND 240),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (duration_clamp_min < duration_clamp_max),
  CHECK (on_time_band_min < late_band_min),
  CHECK (grace_min < no_show_min)
);
INSERT INTO public.dss_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.dss_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dss_settings staff read" ON public.dss_settings;
CREATE POLICY "dss_settings staff read" ON public.dss_settings FOR SELECT TO authenticated
USING (public.get_user_role() IN ('admin', 'doctor', 'compounder'));
-- No write policy: only admin, through dss_update_settings (logged).

CREATE TABLE IF NOT EXISTS public.dss_settings_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL
);
ALTER TABLE public.dss_settings_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dss_settings_log admin read" ON public.dss_settings_log;
CREATE POLICY "dss_settings_log admin read" ON public.dss_settings_log FOR SELECT TO authenticated
USING (public.get_user_role() = 'admin');

------------------------------------------------------------------------------
-- 4. Estimate memory + suggestion dismissals
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dss_appointment_tracking (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  first_eta timestamptz,          -- first estimate after check-in (accuracy report)
  checkin_eta timestamptz,        -- same, kept for "wait grew" suggestion
  last_eta timestamptz,
  last_label text,
  last_notified_eta timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dss_tracking_doctor ON public.dss_appointment_tracking (doctor_id);
ALTER TABLE public.dss_appointment_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dss_tracking staff read" ON public.dss_appointment_tracking;
CREATE POLICY "dss_tracking staff read" ON public.dss_appointment_tracking FOR SELECT TO authenticated
USING (public.dss_can_manage(doctor_id));

CREATE TABLE IF NOT EXISTS public.dss_suggestion_dismissals (
  doctor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  suggestion_key text NOT NULL,
  dismissed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, day, suggestion_key)
);
ALTER TABLE public.dss_suggestion_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dss_dismissals staff read" ON public.dss_suggestion_dismissals;
CREATE POLICY "dss_dismissals staff read" ON public.dss_suggestion_dismissals FOR SELECT TO authenticated
USING (public.dss_can_manage(doctor_id));

------------------------------------------------------------------------------
-- 5. Status rules (DSS-10) and direct-write guard
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_status_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role text;
  v_undo boolean := current_setting('dss.undo', true) = 'on';
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Never back to waiting once a visit finished, for anyone (admin included).
  IF OLD.status IN ('completed', 'prescription_pending') AND NEW.status IN ('hold', 'scheduled', 'checked_in') THEN
    RAISE EXCEPTION 'Invalid transition from % to %: a finished visit cannot go back to waiting', OLD.status, NEW.status;
  END IF;

  -- Reverse moves allowed only inside dss_undo (within its time window).
  IF v_undo AND (
       (OLD.status = 'in_consultation' AND NEW.status = 'checked_in') OR
       (OLD.status = 'prescription_pending' AND NEW.status = 'in_consultation') OR
       (OLD.status = 'no_show' AND NEW.status = 'checked_in')) THEN
    RETURN NEW;
  END IF;

  SELECT (auth.jwt() ->> 'role')::text INTO v_role;
  IF v_role IS NULL OR v_role = 'authenticated' THEN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  END IF;
  IF v_role = 'admin' THEN RETURN NEW; END IF;

  IF OLD.status = 'hold' AND NEW.status NOT IN ('scheduled', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from hold to %', NEW.status;
  ELSIF OLD.status = 'scheduled' AND NEW.status NOT IN ('checked_in', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Invalid transition from scheduled to %', NEW.status;
  ELSIF OLD.status = 'checked_in' AND NEW.status NOT IN ('in_consultation', 'no_show', 'cancelled', 'scheduled') THEN
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
END $$;

-- Queue columns may only change through SECURITY DEFINER functions (or the admin screen).
CREATE OR REPLACE FUNCTION public.dss_guard_queue_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND COALESCE(public.get_user_role(), '') <> 'admin' AND (
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.serial_no IS DISTINCT FROM OLD.serial_no OR
       NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at OR
       NEW.called_at IS DISTINCT FROM OLD.called_at OR
       NEW.consult_started_at IS DISTINCT FROM OLD.consult_started_at OR
       NEW.consult_ended_at IS DISTINCT FROM OLD.consult_ended_at OR
       NEW.priority_level IS DISTINCT FROM OLD.priority_level OR
       NEW.is_priority IS DISTINCT FROM OLD.is_priority OR
       NEW.skipped_at IS DISTINCT FROM OLD.skipped_at OR
       NEW.rejoined_at IS DISTINCT FROM OLD.rejoined_at OR
       NEW.no_show_marked_at IS DISTINCT FROM OLD.no_show_marked_at OR
       NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR
       NEW.appointment_date IS DISTINCT FROM OLD.appointment_date) THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: queue fields can only be changed through queue actions' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dss_guard_queue_columns ON public.appointments;
CREATE TRIGGER trg_dss_guard_queue_columns BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.dss_guard_queue_columns();

------------------------------------------------------------------------------
-- 6. Small helpers (internal)
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date $$;

CREATE OR REPLACE FUNCTION public.dss_booked_at(a public.appointments) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(a.scheduled_start, (a.appointment_date + a.start_time) AT TIME ZONE 'Asia/Dhaka')
$$;

-- B3: counted time = booked time if arrived within grace, else arrival; a rejoin counts from the rejoin.
CREATE OR REPLACE FUNCTION public.dss_counted_time(a public.appointments, p_grace_min int) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    CASE WHEN a.checked_in_at IS NULL OR a.checked_in_at <= public.dss_booked_at(a) + make_interval(mins => p_grace_min)
         THEN public.dss_booked_at(a) ELSE a.checked_in_at END,
    COALESCE(a.rejoined_at, '-infinity'::timestamptz))
$$;

CREATE OR REPLACE FUNCTION public._dss_require(p_doctor uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'DSS_UNAUTHENTICATED: login required' USING ERRCODE = '28000';
  END IF;
  IF p_doctor IS NULL OR NOT public.dss_can_manage(p_doctor) THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: not allowed for this doctor' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_user_role();
END $$;

CREATE OR REPLACE FUNCTION public._dss_begin(p_doctor uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb;
BEGIN
  IF p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: request key required' USING ERRCODE = '22023';
  END IF;
  -- One writer per doctor per day: two "Call next" taps are serialised here.
  PERFORM pg_advisory_xact_lock(hashtext('dss:' || p_doctor::text), hashtext(public.dss_today()::text));
  PERFORM set_config('dss.doctor_id', p_doctor::text, true);
  SELECT metadata -> 'result' INTO v_prev FROM public.queue_events
  WHERE actor_user_id = auth.uid() AND request_key = p_request_key LIMIT 1;
  IF v_prev IS NOT NULL THEN
    RETURN v_prev || jsonb_build_object('duplicate', true);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._dss_log(
  p_doctor uuid, p_appt uuid, p_type text, p_from text, p_to text, p_role text,
  p_request_key text, p_meta jsonb, p_result jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_session uuid;
BEGIN
  SELECT id INTO v_session FROM public.doctor_sessions
  WHERE doctor_id = p_doctor AND session_date = public.dss_today() ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.queue_events (appointment_id, doctor_id, event_type, from_status, to_status,
    actor_user_id, actor_role, metadata, request_key, session_id)
  VALUES (p_appt, p_doctor, p_type, p_from, p_to, auth.uid(), p_role,
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('dss', true, 'result', p_result), p_request_key, v_session)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public._dss_result(p_ok boolean, p_code text, p_message text, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('ok', p_ok, 'code', p_code, 'message', p_message) || COALESCE(p_extra, '{}'::jsonb)
$$;

-- B4: real duration = end - start - paused time inside the visit.
CREATE OR REPLACE FUNCTION public._dss_fix_duration(p_appt uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_pause_sec numeric;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appt;
  IF a.consult_started_at IS NULL OR a.consult_ended_at IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM
           LEAST(COALESCE(p.resumed_at, a.consult_ended_at), a.consult_ended_at) - GREATEST(p.paused_at, a.consult_started_at)))), 0)
    INTO v_pause_sec
  FROM public.doctor_session_pauses p JOIN public.doctor_sessions s ON s.id = p.session_id
  WHERE s.doctor_id = a.doctor_id AND s.session_date = a.appointment_date;
  UPDATE public.consultation_analytics_logs
     SET consult_duration_minutes = ROUND(GREATEST(0, EXTRACT(EPOCH FROM (a.consult_ended_at - a.consult_started_at)) - v_pause_sec) / 60.0, 2),
         visit_type = a.visit_type,
         is_priority = a.priority_level > 0
   WHERE appointment_id = p_appt;
END $$;

------------------------------------------------------------------------------
-- 7. Re-created Module 4 functions that needed a behaviour fix
------------------------------------------------------------------------------
-- Walk-in: uses the chosen doctor (multi-doctor compounders) and the doctor's real slot length.
CREATE OR REPLACE FUNCTION public.create_walk_in_appointment(p_patient_id uuid, p_visit_type text, p_is_priority boolean, p_priority_reason text, p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text; v_doc_id uuid; v_day_of_week int; v_appt_date date; v_current_time time;
  v_existing_id uuid; v_max_serial int; v_new_id uuid; v_slot int;
BEGIN
  v_role := public.get_user_role();
  IF v_role != 'compounder' THEN RAISE EXCEPTION 'Only compounders can create walk-ins'; END IF;
  v_doc_id := public.compounder_doctor_id(auth.uid());
  IF v_doc_id IS NULL THEN RAISE EXCEPTION 'Compounder has no assigned doctor'; END IF;

  SELECT appointment_id INTO v_existing_id FROM public.walk_in_requests
  WHERE compounder_id = auth.uid() AND idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;

  v_appt_date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  v_current_time := (now() AT TIME ZONE 'Asia/Dhaka')::time;
  v_day_of_week := EXTRACT(DOW FROM v_appt_date);

  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = p_patient_id) THEN
    RAISE EXCEPTION 'Patient not found or archived';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE patient_id = p_patient_id AND doctor_id = v_doc_id
             AND appointment_date = v_appt_date AND status NOT IN ('cancelled', 'completed', 'no_show')) THEN
    RAISE EXCEPTION 'Patient already has an active appointment with this doctor today';
  END IF;
  SELECT slot_duration_minutes INTO v_slot FROM public.doctor_schedules
  WHERE doctor_id = v_doc_id AND day_of_week = v_day_of_week AND is_active = true
    AND v_current_time >= start_time AND v_current_time <= end_time
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Outside doctor working hours'; END IF;
  IF public.is_doctor_on_leave(v_doc_id, v_appt_date, v_current_time) THEN
    RAISE EXCEPTION 'Doctor is on leave';
  END IF;
  v_slot := COALESCE(v_slot, (SELECT default_slot_min FROM public.dss_settings WHERE id = 1), 10);

  PERFORM pg_advisory_xact_lock(hashtext(v_doc_id::text), hashtext(v_appt_date::text));
  SELECT COALESCE(MAX(serial_no), 0) INTO v_max_serial FROM public.appointments
  WHERE doctor_id = v_doc_id AND appointment_date = v_appt_date;

  v_new_id := gen_random_uuid();
  INSERT INTO public.appointments (
    id, patient_id, doctor_id, appointment_date, start_time, end_time,
    status, serial_no, scheduled_start, slot_minutes, visit_type, is_priority, priority_reason, priority_level,
    visit_source, created_by_user_id, checked_in_at, status_changed_by, status_changed_at
  ) VALUES (
    v_new_id, p_patient_id, v_doc_id, v_appt_date, v_current_time, v_current_time + make_interval(mins => v_slot),
    'checked_in', v_max_serial + 1, now(), v_slot, p_visit_type, p_is_priority, p_priority_reason,
    CASE WHEN p_is_priority THEN 1 ELSE 0 END,
    'walk_in', auth.uid(), now(), auth.uid(), now()
  );
  INSERT INTO public.walk_in_requests (compounder_id, idempotency_key, appointment_id)
  VALUES (auth.uid(), p_idempotency_key, v_new_id);
  INSERT INTO public.queue_events (appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata)
  VALUES (v_new_id, v_doc_id, 'walk_in_created', 'scheduled', 'checked_in', auth.uid(), v_role, '{}'::jsonb);
  RETURN v_new_id;
END $$;

-- No-show: allowed after grace_min (setting) instead of a hard-coded 15 minutes.
CREATE OR REPLACE FUNCTION public.mark_no_show(p_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt public.appointments; v_role text; v_grace int;
BEGIN
  v_role := public.get_user_role();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND v_appt.doctor_id = auth.uid() THEN
  ELSIF v_role = 'compounder' AND public.compounder_doctor_id(auth.uid()) = v_appt.doctor_id THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT grace_min INTO v_grace FROM public.dss_settings WHERE id = 1;
  IF v_role != 'admin' AND public.dss_booked_at(v_appt) + make_interval(mins => COALESCE(v_grace, 10)) > now() THEN
    RAISE EXCEPTION 'Grace period: cannot mark no-show until % minutes after the booked time', COALESCE(v_grace, 10);
  END IF;

  UPDATE public.appointments
     SET status = 'no_show', no_show_marked_at = now(), status_changed_at = now(), status_changed_by = auth.uid()
   WHERE id = p_id;
  INSERT INTO public.queue_events (appointment_id, doctor_id, event_type, from_status, to_status, actor_user_id, actor_role, metadata)
  VALUES (p_id, v_appt.doctor_id, 'no_show_marked', v_appt.status, 'no_show', auth.uid(), v_role, jsonb_build_object('reason', p_reason));
END $$;

------------------------------------------------------------------------------
-- 8. DSS actions (DSS-15 .. DSS-22). Each: check caller → lock → repeat check → wrap Module 4 → log.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_check_in(p_appointment_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status <> 'scheduled' THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.', jsonb_build_object('status', a.status));
  END IF;
  PERFORM public.check_in_appointment(a.id);
  UPDATE public.appointments SET skipped_at = NULL WHERE id = a.id;
  v_res := public._dss_result(true, 'ok', format('Serial %s checked in.', a.serial_no),
           jsonb_build_object('appointment_id', a.id, 'serial_no', a.serial_no));
  PERFORM public._dss_log(a.doctor_id, a.id, 'check_in', 'scheduled', 'checked_in', v_role, p_request_key,
    jsonb_build_object('serial_no', a.serial_no, 'prev', jsonb_build_object('skipped_at', a.skipped_at)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_call_next(p_doctor_id uuid, p_expected_current uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text; v_dup jsonb; v_res jsonb; v_cur public.appointments; v_next public.appointments;
  v_sess public.doctor_sessions; v_grace int; v_today date := public.dss_today();
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;

  SELECT * INTO v_cur FROM public.appointments WHERE doctor_id = p_doctor_id AND status = 'in_consultation' LIMIT 1;
  IF v_cur.id IS DISTINCT FROM p_expected_current THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.');
  END IF;
  SELECT * INTO v_sess FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = v_today ORDER BY created_at DESC LIMIT 1;
  IF v_sess.status = 'paused' THEN
    RETURN public._dss_result(false, 'paused', 'The session is paused. Resume it first.');
  END IF;
  IF v_sess.status = 'ended' THEN
    RETURN public._dss_result(false, 'session_ended', 'The session has ended.');
  END IF;

  IF v_cur.id IS NOT NULL THEN
    PERFORM public.end_consultation(v_cur.id);
    PERFORM public._dss_fix_duration(v_cur.id);
  END IF;

  SELECT grace_min INTO v_grace FROM public.dss_settings WHERE id = 1;
  SELECT a.* INTO v_next FROM public.appointments a
  WHERE a.doctor_id = p_doctor_id AND a.appointment_date = v_today AND a.status = 'checked_in' AND a.skipped_at IS NULL
  ORDER BY a.priority_level DESC, public.dss_counted_time(a, COALESCE(v_grace, 10)) ASC, a.serial_no ASC
  LIMIT 1;

  IF v_next.id IS NULL THEN
    IF v_cur.id IS NULL THEN
      RETURN public._dss_result(false, 'queue_empty', 'Nobody is waiting.');
    END IF;
    v_res := public._dss_result(true, 'queue_empty', format('Serial %s done. Nobody else is waiting.', v_cur.serial_no),
             jsonb_build_object('ended_id', v_cur.id, 'ended_serial', v_cur.serial_no));
  ELSE
    IF v_sess.id IS NULL THEN
      PERFORM public.dss_session_start_internal(p_doctor_id, v_role, NULL);
    END IF;
    PERFORM public.start_consultation(v_next.id);
    UPDATE public.appointments SET called_at = now() WHERE id = v_next.id;
    v_res := public._dss_result(true, 'ok', format('Serial %s called.', v_next.serial_no),
             jsonb_build_object('started_id', v_next.id, 'started_serial', v_next.serial_no,
                                'ended_id', v_cur.id, 'ended_serial', v_cur.serial_no));
  END IF;
  PERFORM public._dss_log(p_doctor_id, COALESCE(v_next.id, v_cur.id), 'call_next', NULL, NULL, v_role, p_request_key,
    jsonb_build_object('started_id', v_next.id, 'ended_id', v_cur.id, 'started_serial', v_next.serial_no, 'ended_serial', v_cur.serial_no), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_end_consult(p_appointment_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status <> 'in_consultation' THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.');
  END IF;
  PERFORM public.end_consultation(a.id);
  PERFORM public._dss_fix_duration(a.id);
  v_res := public._dss_result(true, 'ok', format('Serial %s done.', a.serial_no),
           jsonb_build_object('ended_id', a.id, 'ended_serial', a.serial_no));
  PERFORM public._dss_log(a.doctor_id, a.id, 'end_consult', 'in_consultation', 'prescription_pending', v_role, p_request_key,
    jsonb_build_object('ended_id', a.id, 'ended_serial', a.serial_no), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_mark_no_show(p_appointment_id uuid, p_reason text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status NOT IN ('scheduled', 'checked_in') THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.', jsonb_build_object('status', a.status));
  END IF;
  PERFORM public.mark_no_show(a.id, COALESCE(NULLIF(trim(p_reason), ''), 'Patient did not arrive'));
  v_res := public._dss_result(true, 'ok', format('Serial %s marked as no-show.', a.serial_no),
           jsonb_build_object('appointment_id', a.id, 'serial_no', a.serial_no));
  PERFORM public._dss_log(a.doctor_id, a.id, 'no_show', a.status, 'no_show', v_role, p_request_key,
    jsonb_build_object('serial_no', a.serial_no, 'prev', jsonb_build_object('status', a.status)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_set_priority(p_appointment_id uuid, p_level int, p_reason text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  IF p_level IS NULL OR p_level NOT BETWEEN 0 AND 2 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: priority level must be 0, 1 or 2' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status NOT IN ('scheduled', 'checked_in') THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.', jsonb_build_object('status', a.status));
  END IF;
  IF p_level > 0 THEN
    PERFORM public.set_priority(a.id, COALESCE(NULLIF(trim(p_reason), ''), CASE p_level WHEN 2 THEN 'Emergency' ELSE 'Priority' END));
  END IF;
  UPDATE public.appointments
     SET priority_level = p_level, is_priority = p_level > 0,
         priority_reason = CASE WHEN p_level = 0 THEN NULL ELSE priority_reason END
   WHERE id = a.id;
  v_res := public._dss_result(true, 'ok',
           format('Serial %s set to %s.', a.serial_no, CASE p_level WHEN 2 THEN 'emergency' WHEN 1 THEN 'priority' ELSE 'normal' END),
           jsonb_build_object('appointment_id', a.id, 'serial_no', a.serial_no, 'level', p_level));
  PERFORM public._dss_log(a.doctor_id, a.id, 'priority_set', a.status, a.status, v_role, p_request_key,
    jsonb_build_object('serial_no', a.serial_no, 'level', p_level,
      'prev', jsonb_build_object('priority_level', a.priority_level, 'is_priority', a.is_priority, 'priority_reason', a.priority_reason)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_skip(p_appointment_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status NOT IN ('scheduled', 'checked_in') OR a.skipped_at IS NOT NULL THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.');
  END IF;
  UPDATE public.appointments SET skipped_at = now() WHERE id = a.id;
  v_res := public._dss_result(true, 'ok', format('Serial %s skipped for now.', a.serial_no),
           jsonb_build_object('appointment_id', a.id, 'serial_no', a.serial_no));
  PERFORM public._dss_log(a.doctor_id, a.id, 'skip', a.status, a.status, v_role, p_request_key,
    jsonb_build_object('serial_no', a.serial_no, 'prev', jsonb_build_object('skipped_at', a.skipped_at)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_rejoin(p_appointment_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.status NOT IN ('scheduled', 'checked_in') OR a.skipped_at IS NULL THEN
    RETURN public._dss_result(false, 'stale', 'Already updated by someone else.');
  END IF;
  UPDATE public.appointments SET skipped_at = NULL,
         rejoined_at = CASE WHEN a.status = 'checked_in' THEN now() ELSE rejoined_at END
   WHERE id = a.id;
  v_res := public._dss_result(true, 'ok', format('Serial %s is back in the line.', a.serial_no),
           jsonb_build_object('appointment_id', a.id, 'serial_no', a.serial_no));
  PERFORM public._dss_log(a.doctor_id, a.id, 'rejoin', a.status, a.status, v_role, p_request_key,
    jsonb_build_object('serial_no', a.serial_no, 'prev', jsonb_build_object('skipped_at', a.skipped_at, 'rejoined_at', a.rejoined_at)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_walk_in(p_doctor_id uuid, p_patient_id uuid, p_visit_type text, p_level int, p_reason text, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_id uuid; v_serial int;
BEGIN
  IF p_visit_type NOT IN ('new', 'follow_up') OR p_level IS NULL OR p_level NOT BETWEEN 0 AND 2 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: invalid walk-in' USING ERRCODE = '22023';
  END IF;
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  v_id := public.create_walk_in_appointment(p_patient_id, p_visit_type, p_level > 0, COALESCE(p_reason, ''), p_request_key);
  UPDATE public.appointments SET priority_level = p_level WHERE id = v_id;
  SELECT serial_no INTO v_serial FROM public.appointments WHERE id = v_id;
  v_res := public._dss_result(true, 'ok', format('Walk-in added as serial %s.', v_serial),
           jsonb_build_object('appointment_id', v_id, 'serial_no', v_serial));
  PERFORM public._dss_log(p_doctor_id, v_id, 'walk_in_added', NULL, 'checked_in', v_role, p_request_key,
    jsonb_build_object('serial_no', v_serial, 'level', p_level), v_res);
  RETURN v_res;
END $$;

-- Session start that picks today's schedule window (the one running now, else the next), so lateness is right.
CREATE OR REPLACE FUNCTION public.dss_session_start_internal(p_doctor_id uuid, p_role text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now_t time := (now() AT TIME ZONE 'Asia/Dhaka')::time; v_sched record; v_id uuid; v_s public.doctor_sessions; v_res jsonb;
BEGIN
  SELECT start_time, end_time, slot_duration_minutes INTO v_sched FROM public.doctor_schedules
  WHERE doctor_id = p_doctor_id AND day_of_week = EXTRACT(DOW FROM public.dss_today()) AND is_active
  ORDER BY (v_now_t <= end_time) DESC, start_time
  LIMIT 1;
  v_id := public.start_doctor_session(p_doctor_id, v_sched.start_time, NULL::text, NULL::numeric);
  UPDATE public.doctor_sessions
     SET scheduled_end = COALESCE(scheduled_end, v_sched.end_time),
         slot_minutes = COALESCE(slot_minutes, v_sched.slot_duration_minutes)
   WHERE id = v_id
  RETURNING * INTO v_s;
  v_res := public._dss_result(true, 'ok',
           CASE WHEN COALESCE(v_s.delay_minutes, 0) > 0 THEN format('Session started, %s min late.', round(v_s.delay_minutes)) ELSE 'Session started.' END,
           jsonb_build_object('session_id', v_s.id, 'started_at', v_s.started_at, 'delay_minutes', v_s.delay_minutes));
  PERFORM public._dss_log(p_doctor_id, NULL, 'session_start', 'not_started', 'active', p_role, p_request_key,
    jsonb_build_object('session_id', v_id, 'scheduled_start', v_sched.start_time, 'delay_minutes', v_s.delay_minutes), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_session_start(p_doctor_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb;
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = public.dss_today() AND status <> 'ended') THEN
    RETURN public._dss_result(false, 'stale', 'The session has already started.');
  END IF;
  RETURN public.dss_session_start_internal(p_doctor_id, v_role, p_request_key);
END $$;

CREATE OR REPLACE FUNCTION public.dss_session_pause(p_doctor_id uuid, p_reason text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_reason text := COALESCE(NULLIF(left(trim(p_reason), 120), ''), 'Short break');
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = public.dss_today() AND status = 'open') THEN
    RETURN public._dss_result(false, 'stale', 'The session is not active.');
  END IF;
  PERFORM public.pause_doctor_session(p_doctor_id, v_reason);
  v_res := public._dss_result(true, 'ok', 'Session paused.', jsonb_build_object('reason', v_reason));
  PERFORM public._dss_log(p_doctor_id, NULL, 'pause', 'active', 'paused', v_role, p_request_key, jsonb_build_object('reason', v_reason), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_session_resume(p_doctor_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_paused_at timestamptz;
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT p.paused_at INTO v_paused_at FROM public.doctor_session_pauses p JOIN public.doctor_sessions s ON s.id = p.session_id
  WHERE s.doctor_id = p_doctor_id AND s.status = 'paused' AND p.resumed_at IS NULL ORDER BY p.paused_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN public._dss_result(false, 'stale', 'The session is not paused.');
  END IF;
  PERFORM public.resume_doctor_session(p_doctor_id);
  v_res := public._dss_result(true, 'ok', 'Session resumed.',
           jsonb_build_object('paused_minutes', round(EXTRACT(EPOCH FROM now() - v_paused_at) / 60)));
  PERFORM public._dss_log(p_doctor_id, NULL, 'resume', 'paused', 'active', v_role, p_request_key, '{}'::jsonb, v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_session_end(p_doctor_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_left int;
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = public.dss_today() AND status <> 'ended') THEN
    RETURN public._dss_result(false, 'stale', 'There is no running session.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id = p_doctor_id AND status = 'in_consultation') THEN
    RETURN public._dss_result(false, 'busy', 'A patient is still in the room. Tap Done first.');
  END IF;
  PERFORM public.end_doctor_session(p_doctor_id);
  SELECT count(*) INTO v_left FROM public.appointments
  WHERE doctor_id = p_doctor_id AND appointment_date = public.dss_today() AND status IN ('scheduled', 'checked_in');
  v_res := public._dss_result(true, 'ok',
           CASE WHEN v_left > 0 THEN format('Session ended. %s patient(s) still need to be resolved.', v_left) ELSE 'Session ended.' END,
           jsonb_build_object('unresolved', v_left));
  PERFORM public._dss_log(p_doctor_id, NULL, 'session_end', 'active', 'ended', v_role, p_request_key, jsonb_build_object('unresolved', v_left), v_res);
  RETURN v_res;
END $$;

-- End of day: mark everyone still waiting/not arrived as no-show in one confirmed tap.
CREATE OR REPLACE FUNCTION public.dss_resolve_remaining(p_doctor_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; r public.appointments; v_n int := 0;
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = public.dss_today() AND status = 'ended') THEN
    RETURN public._dss_result(false, 'stale', 'End the session first.');
  END IF;
  FOR r IN SELECT * FROM public.appointments
           WHERE doctor_id = p_doctor_id AND appointment_date = public.dss_today() AND status IN ('scheduled', 'checked_in')
  LOOP
    UPDATE public.appointments SET status = 'no_show', no_show_marked_at = now(), status_changed_at = now(), status_changed_by = auth.uid()
     WHERE id = r.id;
    PERFORM public._dss_log(p_doctor_id, r.id, 'no_show', r.status, 'no_show', v_role, NULL,
      jsonb_build_object('serial_no', r.serial_no, 'reason', 'Not seen before the session ended', 'bulk', true), NULL);
    v_n := v_n + 1;
  END LOOP;
  v_res := public._dss_result(true, 'ok', format('%s patient(s) marked as no-show.', v_n), jsonb_build_object('count', v_n));
  PERFORM public._dss_log(p_doctor_id, NULL, 'resolve_remaining', NULL, NULL, v_role, p_request_key, jsonb_build_object('count', v_n), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_broadcast_delay(p_doctor_id uuid, p_minutes int, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_n int;
BEGIN
  IF p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: minutes must be 1-600' USING ERRCODE = '22023';
  END IF;
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  PERFORM public.record_doctor_delay(p_doctor_id, p_minutes, 'Running late');
  SELECT count(*) INTO v_n FROM public.appointments
  WHERE doctor_id = p_doctor_id AND appointment_date = public.dss_today() AND status IN ('scheduled', 'checked_in');
  v_res := public._dss_result(true, 'ok', format('Delay notice sent to %s patient(s).', v_n),
           jsonb_build_object('recipients', v_n, 'minutes', p_minutes));
  PERFORM public._dss_log(p_doctor_id, NULL, 'delay_broadcast', NULL, NULL, v_role, p_request_key,
    jsonb_build_object('minutes', p_minutes, 'recipients', v_n), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.dss_dismiss_suggestion(p_doctor_id uuid, p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._dss_require(p_doctor_id);
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: bad suggestion key' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.dss_suggestion_dismissals (doctor_id, day, suggestion_key, dismissed_by)
  VALUES (p_doctor_id, public.dss_today(), p_key, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN public._dss_result(true, 'ok', 'Dismissed.');
END $$;

-- B9: undo your own last action within undo_window_sec.
CREATE OR REPLACE FUNCTION public.dss_undo(p_doctor_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text; v_dup jsonb; v_res jsonb; e public.queue_events; v_window int; v_n int;
  v_started uuid; v_ended uuid;
BEGIN
  v_role := public._dss_require(p_doctor_id);
  v_dup := public._dss_begin(p_doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT undo_window_sec INTO v_window FROM public.dss_settings WHERE id = 1;

  SELECT q.* INTO e FROM public.queue_events q
  WHERE q.doctor_id = p_doctor_id AND q.actor_user_id = auth.uid() AND q.request_key IS NOT NULL
    AND q.event_type IN ('check_in', 'call_next', 'end_consult', 'no_show', 'priority_set', 'skip', 'rejoin', 'walk_in_added')
    AND (q.metadata -> 'result' ->> 'ok')::boolean
    AND q.occurred_at > now() - make_interval(secs => COALESCE(v_window, 120))
    AND NOT EXISTS (SELECT 1 FROM public.queue_events u WHERE u.event_type = 'undo' AND u.metadata ->> 'undo_of' = q.id::text)
  ORDER BY q.occurred_at DESC LIMIT 1;
  IF e.id IS NULL THEN
    RETURN public._dss_result(false, 'nothing_to_undo', 'Nothing to undo (only your own actions from the last few minutes).');
  END IF;
  -- Someone else changed the same patient afterwards: the screen is out of date.
  IF EXISTS (SELECT 1 FROM public.queue_events l WHERE l.occurred_at > e.occurred_at AND l.id <> e.id
             AND l.appointment_id IN (e.appointment_id, (e.metadata ->> 'started_id')::uuid, (e.metadata ->> 'ended_id')::uuid)) THEN
    RETURN public._dss_result(false, 'stale', 'Cannot undo: this patient was updated again after your action.');
  END IF;

  PERFORM set_config('dss.undo', 'on', true);
  CASE e.event_type
    WHEN 'check_in' THEN
      UPDATE public.appointments SET status = 'scheduled', checked_in_at = NULL, status_changed_at = now(), status_changed_by = auth.uid(),
             skipped_at = NULLIF(e.metadata -> 'prev' ->> 'skipped_at', '')::timestamptz
       WHERE id = e.appointment_id AND status = 'checked_in';
    WHEN 'call_next', 'end_consult' THEN
      v_started := (e.metadata ->> 'started_id')::uuid;
      v_ended := (e.metadata ->> 'ended_id')::uuid;
      IF v_started IS NOT NULL THEN
        UPDATE public.appointments SET status = 'checked_in', consult_started_at = NULL, called_at = NULL, status_changed_at = now(), status_changed_by = auth.uid()
         WHERE id = v_started AND status = 'in_consultation';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN RAISE EXCEPTION 'DSS_STALE'; END IF;
      END IF;
      IF v_ended IS NOT NULL THEN
        UPDATE public.appointments SET status = 'in_consultation', consult_ended_at = NULL, status_changed_at = now(), status_changed_by = auth.uid()
         WHERE id = v_ended AND status = 'prescription_pending';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 THEN RAISE EXCEPTION 'DSS_STALE'; END IF;
        DELETE FROM public.consultation_analytics_logs WHERE appointment_id = v_ended;
      END IF;
    WHEN 'no_show' THEN
      UPDATE public.appointments SET status = e.metadata -> 'prev' ->> 'status', no_show_marked_at = NULL, status_changed_at = now(), status_changed_by = auth.uid()
       WHERE id = e.appointment_id AND status = 'no_show';
    WHEN 'priority_set' THEN
      UPDATE public.appointments
         SET priority_level = (e.metadata -> 'prev' ->> 'priority_level')::smallint,
             is_priority = (e.metadata -> 'prev' ->> 'is_priority')::boolean,
             priority_reason = e.metadata -> 'prev' ->> 'priority_reason'
       WHERE id = e.appointment_id;
    WHEN 'skip', 'rejoin' THEN
      UPDATE public.appointments
         SET skipped_at = NULLIF(e.metadata -> 'prev' ->> 'skipped_at', '')::timestamptz,
             rejoined_at = CASE WHEN e.event_type = 'rejoin' THEN NULLIF(e.metadata -> 'prev' ->> 'rejoined_at', '')::timestamptz ELSE rejoined_at END
       WHERE id = e.appointment_id;
    WHEN 'walk_in_added' THEN
      PERFORM public.retract_walk_in(e.appointment_id);
  END CASE;
  PERFORM set_config('dss.undo', 'off', true);

  v_res := public._dss_result(true, 'ok', 'Undone.', jsonb_build_object('undone_type', e.event_type, 'undo_of', e.id));
  PERFORM public._dss_log(p_doctor_id, e.appointment_id, 'undo', NULL, NULL, v_role, p_request_key,
    jsonb_build_object('undo_of', e.id::text, 'undone_type', e.event_type), v_res);
  RETURN v_res;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'DSS_STALE' THEN
    RETURN public._dss_result(false, 'stale', 'Cannot undo: the queue changed after your action.');
  END IF;
  RAISE;
END $$;

------------------------------------------------------------------------------
-- 9. Read: everything the engine needs for one doctor and day (DSS-40)
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_snapshot_input(p_doctor_id uuid, p_date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_date date := COALESCE(p_date, public.dss_today());
  v_identity boolean;
  v_slot int; v_spec text; v_out jsonb;
BEGIN
  -- Staff see names; the service role (used only by the patient endpoint after an ownership check) does not.
  IF auth.role() = 'service_role' THEN
    v_identity := false;
  ELSE
    PERFORM public._dss_require(p_doctor_id);
    v_identity := true;
  END IF;

  SELECT s.name INTO v_spec FROM public.doctor_specialities ds JOIN public.specialities s ON s.id = ds.speciality_id
  WHERE ds.doctor_id = p_doctor_id LIMIT 1;

  SELECT jsonb_build_object(
    'server_now', now(),
    'date', v_date,
    'settings', (SELECT to_jsonb(st) - 'id' - 'updated_by' FROM public.dss_settings st WHERE id = 1),
    'doctor', jsonb_build_object(
       'id', u.id, 'name', u.full_name, 'speciality', v_spec,
       'schedules', COALESCE((SELECT jsonb_agg(jsonb_build_object('start', sc.start_time, 'end', sc.end_time, 'slot_min', sc.slot_duration_minutes) ORDER BY sc.start_time)
                     FROM public.doctor_schedules sc WHERE sc.doctor_id = p_doctor_id AND sc.is_active AND sc.day_of_week = EXTRACT(DOW FROM v_date)), '[]'::jsonb)),
    'session', (SELECT jsonb_build_object('id', s.id, 'status', s.status, 'started_at', s.started_at, 'ended_at', s.ended_at,
                  'scheduled_start', s.scheduled_start, 'scheduled_end', s.scheduled_end, 'delay_minutes', s.delay_minutes,
                  'delay_reason', s.delay_reason, 'delay_notified_at', s.delay_notified_at,
                  'pauses', COALESCE((SELECT jsonb_agg(jsonb_build_object('paused_at', p.paused_at, 'resumed_at', p.resumed_at, 'reason', p.reason) ORDER BY p.paused_at)
                                      FROM public.doctor_session_pauses p WHERE p.session_id = s.id), '[]'::jsonb))
                FROM public.doctor_sessions s WHERE s.doctor_id = p_doctor_id AND s.session_date = v_date
                ORDER BY (s.status <> 'ended') DESC, s.created_at DESC LIMIT 1),
    'appointments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'id', a.id, 'serial_no', a.serial_no, 'status', a.status,
                  'booked_at', public.dss_booked_at(a), 'slot_minutes', a.slot_minutes,
                  'checked_in_at', a.checked_in_at, 'called_at', a.called_at,
                  'consult_started_at', a.consult_started_at, 'consult_ended_at', a.consult_ended_at,
                  'priority_level', a.priority_level, 'visit_type', a.visit_type, 'visit_source', a.visit_source,
                  'skipped_at', a.skipped_at, 'rejoined_at', a.rejoined_at, 'no_show_marked_at', a.no_show_marked_at,
                  'patient_name', CASE WHEN v_identity THEN p.full_name END,
                  'patient_uhid', CASE WHEN v_identity THEN p.uhid END) ORDER BY a.serial_no)
                FROM public.appointments a JOIN public.patients p ON p.id = a.patient_id
                WHERE a.doctor_id = p_doctor_id AND a.appointment_date = v_date AND a.status NOT IN ('hold', 'cancelled')), '[]'::jsonb),
    'history', jsonb_build_object(
       'new', COALESCE((SELECT jsonb_agg(d) FROM (SELECT l.consult_duration_minutes AS d FROM public.consultation_analytics_logs l
                 WHERE l.doctor_id = p_doctor_id AND COALESCE(l.visit_type, 'new') = 'new' AND l.consult_duration_minutes BETWEEN 1 AND 120
                 ORDER BY COALESCE(l.consult_ended_at, l.created_at) DESC LIMIT 30) h), '[]'::jsonb),
       'follow_up', COALESCE((SELECT jsonb_agg(d) FROM (SELECT l.consult_duration_minutes AS d FROM public.consultation_analytics_logs l
                 WHERE l.doctor_id = p_doctor_id AND l.visit_type = 'follow_up' AND l.consult_duration_minutes BETWEEN 1 AND 120
                 ORDER BY COALESCE(l.consult_ended_at, l.created_at) DESC LIMIT 30) h), '[]'::jsonb)),
    'benchmark', (SELECT jsonb_build_object('speciality', b.speciality_name, 'avg', b.avg_consult_minutes, 'min', b.min_consult_minutes, 'max', b.max_consult_minutes)
                  FROM public.department_benchmarks b WHERE b.speciality_name = v_spec),
    'tracking', COALESCE((SELECT jsonb_agg(jsonb_build_object('appointment_id', t.appointment_id, 'first_eta', t.first_eta,
                  'checkin_eta', t.checkin_eta, 'last_eta', t.last_eta, 'last_label', t.last_label))
                FROM public.dss_appointment_tracking t JOIN public.appointments a ON a.id = t.appointment_id
                WHERE a.doctor_id = p_doctor_id AND a.appointment_date = v_date), '[]'::jsonb),
    'last_broadcast', (SELECT jsonb_build_object('at', q.occurred_at, 'minutes', (q.metadata ->> 'minutes')::int)
                FROM public.queue_events q WHERE q.doctor_id = p_doctor_id AND q.event_type = 'delay_broadcast'
                  AND (q.occurred_at AT TIME ZONE 'Asia/Dhaka')::date = v_date ORDER BY q.occurred_at DESC LIMIT 1),
    'dismissed', CASE WHEN v_identity THEN COALESCE((SELECT jsonb_agg(d.suggestion_key) FROM public.dss_suggestion_dismissals d
                WHERE d.doctor_id = p_doctor_id AND d.day = v_date), '[]'::jsonb) ELSE '[]'::jsonb END,
    'my_undo', CASE WHEN v_identity THEN (SELECT jsonb_build_object('event_id', q.id, 'type', q.event_type, 'at', q.occurred_at,
                  'message', q.metadata -> 'result' ->> 'message')
                FROM public.queue_events q
                WHERE q.doctor_id = p_doctor_id AND q.actor_user_id = auth.uid() AND q.request_key IS NOT NULL
                  AND q.event_type IN ('check_in', 'call_next', 'end_consult', 'no_show', 'priority_set', 'skip', 'rejoin', 'walk_in_added')
                  AND (q.metadata -> 'result' ->> 'ok')::boolean
                  AND q.occurred_at > now() - make_interval(secs => (SELECT undo_window_sec FROM public.dss_settings WHERE id = 1))
                  AND NOT EXISTS (SELECT 1 FROM public.queue_events u WHERE u.event_type = 'undo' AND u.metadata ->> 'undo_of' = q.id::text)
                ORDER BY q.occurred_at DESC LIMIT 1) END
  ) INTO v_out
  FROM public.users u WHERE u.id = p_doctor_id;
  RETURN v_out;
END $$;

------------------------------------------------------------------------------
-- 10. Grants: deny by default, open only the public dss_* API to logged-in users.
------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'dss\_%' OR p.proname LIKE '\_dss\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION
  public.dss_check_in(uuid, text),
  public.dss_call_next(uuid, uuid, text),
  public.dss_end_consult(uuid, text),
  public.dss_mark_no_show(uuid, text, text),
  public.dss_set_priority(uuid, int, text, text),
  public.dss_skip(uuid, text),
  public.dss_rejoin(uuid, text),
  public.dss_walk_in(uuid, uuid, text, int, text, text),
  public.dss_session_start(uuid, text),
  public.dss_session_pause(uuid, text, text),
  public.dss_session_resume(uuid, text),
  public.dss_session_end(uuid, text),
  public.dss_resolve_remaining(uuid, text),
  public.dss_broadcast_delay(uuid, int, text),
  public.dss_dismiss_suggestion(uuid, text),
  public.dss_undo(uuid, text),
  public.dss_snapshot_input(uuid, date),
  public.dss_can_manage(uuid)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.dss_snapshot_input(uuid, date) TO service_role;
-- Used inside RLS policies and triggers, which run as the caller:
GRANT EXECUTE ON FUNCTION public.dss_today(), public.dss_booked_at(public.appointments),
  public.dss_counted_time(public.appointments, int) TO authenticated, service_role;
