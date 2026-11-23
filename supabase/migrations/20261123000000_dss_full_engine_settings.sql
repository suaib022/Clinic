-- DSS full engine: settings for the flowq wait-time engine, an admin switch (engine_mode), and a longer visit history.
-- engine_mode 'dss' (default) keeps the DSS rules exactly as before; 'full' makes the queue use the columns below.
-- report_review_min and its CHECK already exist (lab module migration). Safe to re-run. Does not touch queue data.

ALTER TABLE public.dss_settings
  ADD COLUMN IF NOT EXISTS engine_mode text NOT NULL DEFAULT 'dss',
  ADD COLUMN IF NOT EXISTS history_window int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sum_with text NOT NULL DEFAULT 'median',
  ADD COLUMN IF NOT EXISTS expect_arrivals boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_p numeric NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS walk_in_per_hour numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lateness_mean_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lateness_sd_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS range_method text NOT NULL DEFAULT 'quartile_sum',
  ADD COLUMN IF NOT EXISTS range_coverage numeric NOT NULL DEFAULT 0.8;

DO $$ BEGIN
  ALTER TABLE public.dss_settings
    ADD CONSTRAINT dss_settings_engine_mode_chk CHECK (engine_mode IN ('dss', 'full')),
    ADD CONSTRAINT dss_settings_history_window_chk CHECK (history_window BETWEEN 10 AND 500),
    ADD CONSTRAINT dss_settings_sum_with_chk CHECK (sum_with IN ('median', 'mean')),
    ADD CONSTRAINT dss_settings_show_p_chk CHECK (show_p BETWEEN 0.05 AND 1),
    ADD CONSTRAINT dss_settings_walk_in_chk CHECK (walk_in_per_hour BETWEEN 0 AND 30),
    ADD CONSTRAINT dss_settings_lateness_mean_chk CHECK (lateness_mean_min BETWEEN -60 AND 60),
    ADD CONSTRAINT dss_settings_lateness_sd_chk CHECK (lateness_sd_min BETWEEN 0 AND 60),
    ADD CONSTRAINT dss_settings_range_method_chk CHECK (range_method IN ('quartile_sum', 'normal_sum')),
    ADD CONSTRAINT dss_settings_range_coverage_chk CHECK (range_coverage BETWEEN 0.5 AND 0.99);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin write path: same rules as before (admin only, validated, logged), with the new keys.
CREATE OR REPLACE FUNCTION public.dss_update_settings(p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb; v_new jsonb; k text;
  nums text[] := ARRAY['on_time_band_min','late_band_min','grace_min','no_show_min','doctor_late_alert_min','near_turn_count',
                       'undo_window_sec','min_duration_samples','default_slot_min','duration_clamp_min','duration_clamp_max',
                       'report_review_min','history_window','show_p','walk_in_per_hour','lateness_mean_min','lateness_sd_min','range_coverage'];
  txts text[] := ARRAY['engine_mode','sum_with','range_method'];
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: admin only' USING ERRCODE = '42501';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_values) LOOP
    IF NOT ((k = ANY(nums) AND jsonb_typeof(p_values -> k) = 'number')
         OR (k = ANY(txts) AND jsonb_typeof(p_values -> k) = 'string')
         OR (k = 'expect_arrivals' AND jsonb_typeof(p_values -> k) = 'boolean')) THEN
      RAISE EXCEPTION 'DSS_BAD_INPUT: %', k USING ERRCODE = '22023';
    END IF;
  END LOOP;
  SELECT to_jsonb(s) INTO v_old FROM public.dss_settings s WHERE id = 1;
  UPDATE public.dss_settings SET
    on_time_band_min = COALESCE((p_values->>'on_time_band_min')::int, on_time_band_min),
    late_band_min = COALESCE((p_values->>'late_band_min')::int, late_band_min),
    grace_min = COALESCE((p_values->>'grace_min')::int, grace_min),
    no_show_min = COALESCE((p_values->>'no_show_min')::int, no_show_min),
    doctor_late_alert_min = COALESCE((p_values->>'doctor_late_alert_min')::int, doctor_late_alert_min),
    near_turn_count = COALESCE((p_values->>'near_turn_count')::int, near_turn_count),
    undo_window_sec = COALESCE((p_values->>'undo_window_sec')::int, undo_window_sec),
    min_duration_samples = COALESCE((p_values->>'min_duration_samples')::int, min_duration_samples),
    default_slot_min = COALESCE((p_values->>'default_slot_min')::int, default_slot_min),
    duration_clamp_min = COALESCE((p_values->>'duration_clamp_min')::int, duration_clamp_min),
    duration_clamp_max = COALESCE((p_values->>'duration_clamp_max')::int, duration_clamp_max),
    engine_mode = COALESCE(p_values->>'engine_mode', engine_mode),
    report_review_min = COALESCE((p_values->>'report_review_min')::int, report_review_min),
    history_window = COALESCE((p_values->>'history_window')::int, history_window),
    sum_with = COALESCE(p_values->>'sum_with', sum_with),
    expect_arrivals = COALESCE((p_values->>'expect_arrivals')::boolean, expect_arrivals),
    show_p = COALESCE((p_values->>'show_p')::numeric, show_p),
    walk_in_per_hour = COALESCE((p_values->>'walk_in_per_hour')::numeric, walk_in_per_hour),
    lateness_mean_min = COALESCE((p_values->>'lateness_mean_min')::numeric, lateness_mean_min),
    lateness_sd_min = COALESCE((p_values->>'lateness_sd_min')::numeric, lateness_sd_min),
    range_method = COALESCE(p_values->>'range_method', range_method),
    range_coverage = COALESCE((p_values->>'range_coverage')::numeric, range_coverage),
    updated_at = now(), updated_by = auth.uid()
  WHERE id = 1;   -- CHECK constraints reject impossible values
  SELECT to_jsonb(s) INTO v_new FROM public.dss_settings s WHERE id = 1;
  INSERT INTO public.dss_settings_log (changed_by, old_values, new_values) VALUES (auth.uid(), v_old, v_new);
  RETURN v_new;
END $$;

-- Doctor queue snapshot: same as the lab-module version, but the visit-length history is as long as the setting
-- history_window asks for (never below the DSS rule B4 value of 30).
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
                  'priority_level', a.priority_level, 'visit_type', a.visit_type, 'visit_source', a.visit_source, 'visit_reason', a.visit_reason,
                  'skipped_at', a.skipped_at, 'rejoined_at', a.rejoined_at, 'no_show_marked_at', a.no_show_marked_at,
                  'patient_name', CASE WHEN v_identity THEN p.full_name END,
                  'patient_uhid', CASE WHEN v_identity THEN p.uhid END,
                  'patient_mobile', CASE WHEN v_identity THEN p.mobile_no END) ORDER BY a.serial_no)
                FROM public.appointments a JOIN public.patients p ON p.id = a.patient_id
                WHERE a.doctor_id = p_doctor_id AND a.appointment_date = v_date AND a.status NOT IN ('hold', 'cancelled')), '[]'::jsonb),
    'history', jsonb_build_object(
       'new', COALESCE((SELECT jsonb_agg(d) FROM (SELECT l.consult_duration_minutes AS d FROM public.consultation_analytics_logs l
                 WHERE l.doctor_id = p_doctor_id
                   AND NOT EXISTS (SELECT 1 FROM public.appointments rr WHERE rr.id = l.appointment_id AND rr.visit_reason = 'report_review') AND COALESCE(l.visit_type, 'new') = 'new' AND l.consult_duration_minutes BETWEEN 1 AND 120
                 ORDER BY COALESCE(l.consult_ended_at, l.created_at) DESC LIMIT GREATEST(30, COALESCE((SELECT st.history_window FROM public.dss_settings st WHERE st.id = 1), 30))) h), '[]'::jsonb),
       'follow_up', COALESCE((SELECT jsonb_agg(d) FROM (SELECT l.consult_duration_minutes AS d FROM public.consultation_analytics_logs l
                 WHERE l.doctor_id = p_doctor_id
                   AND NOT EXISTS (SELECT 1 FROM public.appointments rr WHERE rr.id = l.appointment_id AND rr.visit_reason = 'report_review') AND l.visit_type = 'follow_up' AND l.consult_duration_minutes BETWEEN 1 AND 120
                 ORDER BY COALESCE(l.consult_ended_at, l.created_at) DESC LIMIT GREATEST(30, COALESCE((SELECT st.history_window FROM public.dss_settings st WHERE st.id = 1), 30))) h), '[]'::jsonb)),
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
