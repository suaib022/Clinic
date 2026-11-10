-- DSS-M4: one in-app notifications table for every role, fed by queue events. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,       -- recipient (account owner for family members)
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL CHECK (length(title) <= 120),
  body text NOT NULL CHECK (length(body) <= 500),
  link text CHECK (link IS NULL OR link LIKE '/%'),                          -- in-app links only
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON public.notifications (appointment_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications own mark read" ON public.notifications;
CREATE POLICY "notifications own mark read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Users may only flip read_at; inserts come from SECURITY DEFINER functions.
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- Keep old patient notifications (copied once, then mirrored).
INSERT INTO public.notifications (user_id, patient_id, appointment_id, type, title, body, link, dedupe_key, read_at, created_at)
SELECT p.auth_user_id, pn.patient_id, pn.appointment_id, COALESCE(pn.type, 'info'), left(COALESCE(pn.title, 'Notice'), 120),
       left(COALESCE(pn.message, ''), 500), CASE WHEN pn.action_url LIKE '/%' THEN pn.action_url END,
       'legacy:' || pn.id, CASE WHEN pn.is_read THEN pn.created_at END, pn.created_at
FROM public.patient_notifications pn JOIN public.patients p ON p.id = pn.patient_id
WHERE p.auth_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.auth_user_id)
ON CONFLICT (user_id, dedupe_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.dss_mirror_patient_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, patient_id, appointment_id, type, title, body, link, dedupe_key, created_at)
  SELECT p.auth_user_id, NEW.patient_id, NEW.appointment_id, COALESCE(NEW.type, 'info'), left(COALESCE(NEW.title, 'Notice'), 120),
         left(COALESCE(NEW.message, ''), 500), CASE WHEN NEW.action_url LIKE '/%' THEN NEW.action_url END, 'legacy:' || NEW.id, NEW.created_at
  FROM public.patients p WHERE p.id = NEW.patient_id AND p.auth_user_id IS NOT NULL
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mirror_patient_notification ON public.patient_notifications;
CREATE TRIGGER trg_mirror_patient_notification AFTER INSERT ON public.patient_notifications
FOR EACH ROW EXECUTE FUNCTION public.dss_mirror_patient_notification();

-- The old policy let every doctor and compounder write any patient's notifications.
DROP POLICY IF EXISTS "Staff and admin full access to notifications" ON public.patient_notifications;
DROP POLICY IF EXISTS "Admin full access to patient notifications" ON public.patient_notifications;
CREATE POLICY "Admin full access to patient notifications" ON public.patient_notifications FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

------------------------------------------------------------------------------
-- Senders (internal). Text is short, plain and never medical.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._dss_notify(p_user uuid, p_patient uuid, p_appt uuid, p_doctor uuid,
  p_type text, p_title text, p_body text, p_link text, p_key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  IF p_user IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.notifications (user_id, patient_id, appointment_id, doctor_id, type, title, body, link, dedupe_key)
  VALUES (p_user, p_patient, p_appt, p_doctor, p_type, left(p_title, 120), left(p_body, 500), p_link, p_key)
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- To the account that owns the appointment; family members are named in the text.
CREATE OR REPLACE FUNCTION public._dss_notify_patient(p_appt uuid, p_type text, p_title text, p_body text, p_link text, p_key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_body text;
BEGIN
  SELECT a.id, a.doctor_id, a.serial_no, p.id AS patient_id, p.full_name, p.auth_user_id, u.full_name AS owner_name
    INTO r
  FROM public.appointments a JOIN public.patients p ON p.id = a.patient_id
  LEFT JOIN public.users u ON u.id = p.auth_user_id
  WHERE a.id = p_appt;
  IF r.auth_user_id IS NULL THEN RETURN 0; END IF;
  v_body := CASE WHEN lower(trim(COALESCE(r.full_name, ''))) <> lower(trim(COALESCE(r.owner_name, '')))
                 THEN format('For %s: %s', r.full_name, p_body) ELSE p_body END;
  RETURN public._dss_notify(r.auth_user_id, r.patient_id, r.id, r.doctor_id, p_type, p_title, v_body,
                            COALESCE(p_link, '/patient/appointments'), p_key);
END $$;

-- To every compounder assigned to the doctor (except the one who did it).
CREATE OR REPLACE FUNCTION public._dss_notify_compounders(p_doctor uuid, p_except uuid, p_type text, p_title text, p_body text, p_key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int := 0; c record;
BEGIN
  FOR c IN SELECT compounder_id FROM public.compounder_doctors WHERE doctor_id = p_doctor AND compounder_id IS DISTINCT FROM p_except LOOP
    v_n := v_n + public._dss_notify(c.compounder_id, NULL, NULL, p_doctor, p_type, p_title, p_body, '/compounder/queue', p_key);
  END LOOP;
  RETURN v_n;
END $$;

-- To everyone still to be seen today (waiting or not arrived).
CREATE OR REPLACE FUNCTION public._dss_notify_waiting(p_doctor uuid, p_type text, p_title text, p_body text, p_key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int := 0; a record;
BEGIN
  FOR a IN SELECT id FROM public.appointments
           WHERE doctor_id = p_doctor AND appointment_date = public.dss_today() AND status IN ('scheduled', 'checked_in') LOOP
    v_n := v_n + public._dss_notify_patient(a.id, p_type, p_title, p_body, NULL, p_key);
  END LOOP;
  RETURN v_n;
END $$;

------------------------------------------------------------------------------
-- B10: notifications from queue actions, created once per event per person (dedupe keys).
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_queue_event_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb := NEW.metadata;
  v_serial text := COALESCE(m ->> 'serial_no', m ->> 'started_serial', '');
  v_started uuid;
BEGIN
  IF COALESCE(m ->> 'dss', '') <> 'true' THEN RETURN NEW; END IF;
  IF m -> 'result' IS NOT NULL AND jsonb_typeof(m -> 'result') = 'object' AND NOT COALESCE((m -> 'result' ->> 'ok')::boolean, false) THEN
    RETURN NEW;
  END IF;

  CASE NEW.event_type
    WHEN 'check_in', 'walk_in_added' THEN
      PERFORM public._dss_notify_patient(NEW.appointment_id, 'checked_in', 'You are checked in',
        format('Serial %s. We will tell you when your turn is near.', v_serial), NULL, 'check_in:' || NEW.appointment_id);
      IF NOT EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = NEW.doctor_id AND session_date = public.dss_today() AND status <> 'ended') THEN
        PERFORM public._dss_notify(NEW.doctor_id, NULL, NULL, NEW.doctor_id, 'patient_waiting', 'A patient is waiting',
          'A patient has checked in and the session has not started yet.', '/doctor/queue',
          'patient_waiting:' || NEW.doctor_id || ':' || public.dss_today());
      END IF;
    WHEN 'call_next' THEN
      v_started := NULLIF(m ->> 'started_id', '')::uuid;
      IF v_started IS NOT NULL THEN
        PERFORM public._dss_notify_patient(v_started, 'called', 'Please go in now',
          format('Serial %s: please go to the doctor now.', m ->> 'started_serial'), NULL, 'called:' || v_started);
      END IF;
    WHEN 'no_show' THEN
      PERFORM public._dss_notify_patient(NEW.appointment_id, 'no_show', 'You were marked absent',
        format('Serial %s was marked absent today. You can book a new visit.', v_serial), '/patient/book', 'no_show:' || NEW.appointment_id);
    WHEN 'pause' THEN
      PERFORM public._dss_notify_waiting(NEW.doctor_id, 'session_paused', 'Doctor is on a short break',
        'The doctor is on a short break. Your place in the queue is kept.', 'pause:' || NEW.id);
      PERFORM public._dss_notify_compounders(NEW.doctor_id, NEW.actor_user_id, 'session_paused', 'Session paused',
        COALESCE('Reason: ' || (m ->> 'reason'), 'The session is paused.'), 'pause:' || NEW.id);
    WHEN 'resume' THEN
      PERFORM public._dss_notify_waiting(NEW.doctor_id, 'session_resumed', 'Doctor has resumed',
        'The doctor is back. The queue is moving again.', 'resume:' || NEW.id);
    WHEN 'delay_broadcast' THEN
      PERFORM public._dss_notify_waiting(NEW.doctor_id, 'doctor_delay', 'Doctor is running late',
        format('The doctor is running about %s min late. Your expected time has moved.', m ->> 'minutes'), 'delay:' || NEW.id);
    WHEN 'session_start' THEN
      PERFORM public._dss_notify_compounders(NEW.doctor_id, NEW.actor_user_id, 'session_started', 'Session started',
        CASE WHEN COALESCE((m ->> 'delay_minutes')::numeric, 0) > 0
             THEN format('The doctor started %s min late.', round((m ->> 'delay_minutes')::numeric)) ELSE 'The doctor started on time.' END,
        'session_start:' || NEW.id);
    WHEN 'session_end' THEN
      PERFORM public._dss_notify_compounders(NEW.doctor_id, NEW.actor_user_id, 'session_ended', 'Session ended',
        CASE WHEN COALESCE((m ->> 'unresolved')::int, 0) > 0
             THEN format('%s patient(s) still need to be resolved.', m ->> 'unresolved') ELSE 'All patients were resolved.' END,
        'session_end:' || NEW.id);
    ELSE NULL;
  END CASE;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dss_queue_event_notify ON public.queue_events;
CREATE TRIGGER trg_dss_queue_event_notify AFTER INSERT ON public.queue_events
FOR EACH ROW EXECUTE FUNCTION public.dss_queue_event_notify();

------------------------------------------------------------------------------
-- Engine-driven notifications: staff screens send the engine's current numbers after each load.
-- The database decides who to tell (near turn, next, time moved, label changed) and remembers what it said.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_sync_estimates(p_doctor_id uuid, p_items jsonb, p_suggestions jsonb DEFAULT '[]'::jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb; a public.appointments; t public.dss_appointment_tracking; s public.dss_settings;
  v_eta timestamptz; v_label text; v_ahead int; v_stage text; v_n int := 0; v_hhmm text; sg jsonb;
BEGIN
  PERFORM public._dss_require(p_doctor_id);
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 300 THEN
    RAISE EXCEPTION 'DSS_BAD_INPUT: items' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM public.dss_settings WHERE id = 1;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO a FROM public.appointments WHERE id = (it ->> 'appointment_id')::uuid;
    CONTINUE WHEN a.id IS NULL OR a.doctor_id <> p_doctor_id OR a.appointment_date <> public.dss_today();
    v_eta := NULLIF(it ->> 'eta', '')::timestamptz;
    v_label := NULLIF(it ->> 'label', '');
    v_ahead := NULLIF(it ->> 'ahead', '')::int;
    v_stage := it ->> 'stage';
    CONTINUE WHEN v_label IS NOT NULL AND v_label NOT IN ('early', 'on_time', 'running_late', 'delayed', 'not_arrived');

    SELECT * INTO t FROM public.dss_appointment_tracking WHERE appointment_id = a.id;
    IF t.appointment_id IS NULL THEN
      INSERT INTO public.dss_appointment_tracking (appointment_id, doctor_id) VALUES (a.id, a.doctor_id) RETURNING * INTO t;
    END IF;

    IF v_stage = 'waiting' AND a.status = 'checked_in' AND v_eta IS NOT NULL THEN
      v_hhmm := to_char(v_eta AT TIME ZONE 'Asia/Dhaka', 'FMHH12:MI AM');
      IF v_ahead = 0 THEN
        v_n := v_n + public._dss_notify_patient(a.id, 'next', 'You are next', 'You are next. Please be ready.', NULL, 'next:' || a.id);
      ELSIF v_ahead <= s.near_turn_count THEN
        v_n := v_n + public._dss_notify_patient(a.id, 'near_turn', 'Your turn is near',
          format('%s patient(s) ahead of you. Please come to the clinic / stay nearby.', v_ahead), NULL, 'near:' || a.id);
      END IF;
      IF t.last_notified_eta IS NOT NULL AND abs(EXTRACT(EPOCH FROM v_eta - t.last_notified_eta)) >= 600 THEN
        v_n := v_n + public._dss_notify_patient(a.id, 'eta_changed', 'Your expected time changed',
          format('Your expected time is now %s.', v_hhmm), NULL, 'eta:' || a.id || ':' || floor(EXTRACT(EPOCH FROM v_eta) / 600));
        t.last_notified_eta := v_eta;
      ELSIF t.last_label IS NOT NULL AND v_label IS DISTINCT FROM t.last_label AND v_label <> 'not_arrived' AND t.last_label <> 'not_arrived' THEN
        v_n := v_n + public._dss_notify_patient(a.id, 'eta_changed', 'Your expected time changed',
          format('Your expected time is now %s (%s).', v_hhmm, replace(v_label, '_', ' ')), NULL, 'label:' || a.id || ':' || v_label);
        t.last_notified_eta := v_eta;
      END IF;
      UPDATE public.dss_appointment_tracking
         SET first_eta = COALESCE(first_eta, v_eta), checkin_eta = COALESCE(checkin_eta, v_eta),
             last_notified_eta = COALESCE(t.last_notified_eta, v_eta),
             last_eta = v_eta, last_label = v_label, updated_at = now()
       WHERE appointment_id = a.id;
    ELSE
      UPDATE public.dss_appointment_tracking SET last_eta = v_eta, last_label = v_label, updated_at = now() WHERE appointment_id = a.id;
    END IF;
  END LOOP;

  -- Warning / urgent suggestions also go to the compounders' bell, once per suggestion per day.
  IF jsonb_typeof(p_suggestions) = 'array' THEN
    FOR sg IN SELECT * FROM jsonb_array_elements(p_suggestions) LOOP
      CONTINUE WHEN sg ->> 'severity' NOT IN ('warning', 'urgent') OR length(COALESCE(sg ->> 'key', '')) NOT BETWEEN 3 AND 200;
      v_n := v_n + public._dss_notify_compounders(p_doctor_id, NULL, 'suggestion', 'Queue suggestion',
        left(COALESCE(sg ->> 'message', ''), 300), 'sugg:' || public.dss_today() || ':' || (sg ->> 'key'));
    END LOOP;
  END IF;
  RETURN v_n;
END $$;

-- Grants (deny by default)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND (p.proname LIKE 'dss\_%' OR p.proname LIKE '\_dss\_%')
             AND p.proname IN ('_dss_notify', '_dss_notify_patient', '_dss_notify_compounders', '_dss_notify_waiting',
                               'dss_queue_event_notify', 'dss_mirror_patient_notification', 'dss_sync_estimates')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.dss_sync_estimates(uuid, jsonb, jsonb) TO authenticated;

-- Realtime: live screens listen to these tables (RLS still applies to every subscriber).
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['notifications', 'appointments', 'queue_events', 'doctor_sessions', 'doctor_session_pauses'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
