-- DSS-M8 security review fixes (see docs/dss-progress.md, DSS-103).

-- HIGH: every column that affects queue order or estimates is guarded, not only status/timestamps.
CREATE OR REPLACE FUNCTION public.dss_guard_queue_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND COALESCE(public.get_user_role(), '') <> 'admin' AND (
       NEW.status IS DISTINCT FROM OLD.status OR NEW.serial_no IS DISTINCT FROM OLD.serial_no OR
       NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at OR NEW.called_at IS DISTINCT FROM OLD.called_at OR
       NEW.consult_started_at IS DISTINCT FROM OLD.consult_started_at OR NEW.consult_ended_at IS DISTINCT FROM OLD.consult_ended_at OR
       NEW.priority_level IS DISTINCT FROM OLD.priority_level OR NEW.is_priority IS DISTINCT FROM OLD.is_priority OR
       NEW.priority_reason IS DISTINCT FROM OLD.priority_reason OR
       NEW.skipped_at IS DISTINCT FROM OLD.skipped_at OR NEW.rejoined_at IS DISTINCT FROM OLD.rejoined_at OR
       NEW.no_show_marked_at IS DISTINCT FROM OLD.no_show_marked_at OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id OR
       NEW.appointment_date IS DISTINCT FROM OLD.appointment_date OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR
       NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start OR NEW.start_time IS DISTINCT FROM OLD.start_time OR
       NEW.end_time IS DISTINCT FROM OLD.end_time OR NEW.slot_minutes IS DISTINCT FROM OLD.slot_minutes OR
       NEW.visit_type IS DISTINCT FROM OLD.visit_type OR NEW.visit_source IS DISTINCT FROM OLD.visit_source) THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: queue fields can only be changed through queue actions' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- LOW: free text bounded (also prevents long clinical notes in a priority reason).
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_priority_reason_len CHECK (priority_reason IS NULL OR length(priority_reason) <= 200) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LOW: notification links must be same-site paths ('//host' is an open redirect).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_link_check;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_link_path CHECK (link IS NULL OR link ~ '^/[^/\\]') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MEDIUM: estimate sync can no longer forge text or flood patients.
CREATE OR REPLACE FUNCTION public.dss_sync_estimates(p_doctor_id uuid, p_items jsonb, p_suggestions jsonb DEFAULT '[]'::jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb; a public.appointments; t public.dss_appointment_tracking; s public.dss_settings;
  v_eta timestamptz; v_label text; v_ahead int; v_stage text; v_n int := 0; v_hhmm text; sg jsonb; v_msg text;
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
    -- never trust a client-sent time far from now (review finding: forged ETAs)
    IF v_eta IS NOT NULL AND (v_eta < now() - interval '6 hours' OR v_eta > now() + interval '18 hours') THEN v_eta := NULL; END IF;
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
      IF t.last_notified_eta IS NOT NULL AND abs(EXTRACT(EPOCH FROM v_eta - t.last_notified_eta)) >= 600
         AND (SELECT count(*) FROM public.notifications WHERE appointment_id = a.id AND type = 'eta_changed') < 6 THEN
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
    -- Fixed text per suggestion type (client free text is never delivered); at most 20 per call.
    FOR sg IN SELECT * FROM jsonb_array_elements(p_suggestions) LIMIT 20 LOOP
      CONTINUE WHEN sg ->> 'severity' NOT IN ('warning', 'urgent') OR COALESCE(sg ->> 'key', '') !~ '^[a-z_]+:[A-Za-z0-9:_-]{1,120}$';
      v_msg := CASE split_part(sg ->> 'key', ':', 1)
        WHEN 'no_show' THEN 'A patient is past the no-show time. Check the live queue.'
        WHEN 'delay' THEN 'The doctor is running behind. Consider notifying waiting patients.'
        WHEN 'check_on' THEN 'A waiting patient''s wait has grown a lot. Please check on them.'
        WHEN 'long_pause' THEN 'The session has been paused for a long time.'
        WHEN 'resolve_remaining' THEN 'The session ended with patients not yet resolved.'
        ELSE NULL END;
      CONTINUE WHEN v_msg IS NULL;
      v_n := v_n + public._dss_notify_compounders(p_doctor_id, NULL, 'suggestion', 'Queue suggestion', v_msg,
        'sugg:' || public.dss_today() || ':' || (sg ->> 'key'));
    END LOOP;
  END IF;
  RETURN v_n;
END $$;


REVOKE ALL ON FUNCTION public.dss_sync_estimates(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dss_sync_estimates(uuid, jsonb, jsonb) TO authenticated;
