-- DSS-M7: admin settings (validated, logged), reports, analytics backfill. Safe to re-run.

-- DSS-92: only admins change settings; every change is logged with old and new values.
CREATE OR REPLACE FUNCTION public.dss_update_settings(p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb; v_new jsonb; k text;
  allowed text[] := ARRAY['on_time_band_min','late_band_min','grace_min','no_show_min','doctor_late_alert_min','near_turn_count',
                          'undo_window_sec','min_duration_samples','default_slot_min','duration_clamp_min','duration_clamp_max'];
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: admin only' USING ERRCODE = '42501';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_values) LOOP
    IF NOT k = ANY(allowed) OR jsonb_typeof(p_values -> k) <> 'number' THEN
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
    updated_at = now(), updated_by = auth.uid()
  WHERE id = 1;   -- CHECK constraints reject impossible values (e.g. grace >= no-show)
  SELECT to_jsonb(s) INTO v_new FROM public.dss_settings s WHERE id = 1;
  INSERT INTO public.dss_settings_log (changed_by, old_values, new_values) VALUES (auth.uid(), v_old, v_new);
  RETURN v_new;
END $$;

-- DSS-93: per-doctor report over a date range, read from existing data.
CREATE OR REPLACE FUNCTION public.dss_report(p_from date, p_to date, p_doctor uuid DEFAULT NULL, p_speciality text DEFAULT NULL)
RETURNS TABLE (
  doctor_id uuid, doctor_name text, speciality text, booked int, seen int, no_shows int, walk_ins int,
  no_show_rate numeric, walk_in_share numeric, avg_visit_new numeric, avg_visit_follow_up numeric,
  avg_start_delay numeric, estimate_mae numeric, estimate_samples int, busiest_hour int
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'DSS_FORBIDDEN: admin only' USING ERRCODE = '42501';
  END IF;
  IF p_to < p_from OR p_to - p_from > 366 THEN RAISE EXCEPTION 'DSS_BAD_INPUT: range' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH a AS (
    SELECT ap.*, (SELECT s.name FROM doctor_specialities ds JOIN specialities s ON s.id = ds.speciality_id WHERE ds.doctor_id = ap.doctor_id LIMIT 1) AS spec
    FROM appointments ap
    WHERE ap.appointment_date BETWEEN p_from AND p_to AND ap.status NOT IN ('hold', 'cancelled')
      AND (p_doctor IS NULL OR ap.doctor_id = p_doctor)
  ), f AS (SELECT * FROM a WHERE p_speciality IS NULL OR a.spec = p_speciality)
  SELECT f.doctor_id, u.full_name, max(f.spec),
    count(*)::int,
    count(*) FILTER (WHERE f.status IN ('completed', 'prescription_pending'))::int,
    count(*) FILTER (WHERE f.status = 'no_show')::int,
    count(*) FILTER (WHERE f.visit_source = 'walk_in')::int,
    round(100.0 * count(*) FILTER (WHERE f.status = 'no_show') / nullif(count(*), 0), 1),
    round(100.0 * count(*) FILTER (WHERE f.visit_source = 'walk_in') / nullif(count(*), 0), 1),
    (SELECT round(avg(l.consult_duration_minutes), 1) FROM consultation_analytics_logs l JOIN f f2 ON f2.id = l.appointment_id
       WHERE f2.doctor_id = f.doctor_id AND COALESCE(l.visit_type, 'new') = 'new' AND l.consult_duration_minutes BETWEEN 1 AND 120),
    (SELECT round(avg(l.consult_duration_minutes), 1) FROM consultation_analytics_logs l JOIN f f2 ON f2.id = l.appointment_id
       WHERE f2.doctor_id = f.doctor_id AND l.visit_type = 'follow_up' AND l.consult_duration_minutes BETWEEN 1 AND 120),
    (SELECT round(avg(COALESCE(s.delay_minutes, 0)), 1) FROM doctor_sessions s
       WHERE s.doctor_id = f.doctor_id AND s.session_date BETWEEN p_from AND p_to),
    round(avg(abs(EXTRACT(EPOCH FROM f.consult_started_at - t.first_eta)) / 60) FILTER (WHERE t.first_eta IS NOT NULL AND f.consult_started_at IS NOT NULL), 1),
    (count(*) FILTER (WHERE t.first_eta IS NOT NULL AND f.consult_started_at IS NOT NULL))::int,
    (SELECT EXTRACT(HOUR FROM f3.checked_in_at AT TIME ZONE 'Asia/Dhaka')::int FROM f f3
       WHERE f3.doctor_id = f.doctor_id AND f3.checked_in_at IS NOT NULL AND f3.consult_started_at IS NOT NULL
       GROUP BY 1 ORDER BY avg(EXTRACT(EPOCH FROM f3.consult_started_at - f3.checked_in_at)) DESC LIMIT 1)
  FROM f JOIN users u ON u.id = f.doctor_id
  LEFT JOIN dss_appointment_tracking t ON t.appointment_id = f.id
  GROUP BY f.doctor_id, u.full_name
  ORDER BY count(*) DESC;
END $$;

-- DSS-95: every finished visit with real times feeds tomorrow's estimates (durations only; see audit §2).
INSERT INTO public.consultation_analytics_logs (appointment_id, doctor_id, patient_id, serial_no, visit_type, visit_source,
  is_priority, scheduled_slot_time, checked_in_at, consult_started_at, consult_ended_at, consult_duration_minutes)
SELECT a.id, a.doctor_id, a.patient_id, a.serial_no, a.visit_type, a.visit_source, a.priority_level > 0, a.start_time,
  a.checked_in_at, a.consult_started_at, a.consult_ended_at,
  round(EXTRACT(EPOCH FROM a.consult_ended_at - a.consult_started_at) / 60.0, 2)
FROM public.appointments a
WHERE a.status IN ('completed', 'prescription_pending') AND a.consult_started_at IS NOT NULL AND a.consult_ended_at IS NOT NULL
  AND a.consult_ended_at > a.consult_started_at
  AND NOT EXISTS (SELECT 1 FROM public.consultation_analytics_logs l WHERE l.appointment_id = a.id);

CREATE INDEX IF NOT EXISTS idx_appointments_date_doctor ON public.appointments (appointment_date, doctor_id);

REVOKE ALL ON FUNCTION public.dss_update_settings(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dss_report(date, date, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dss_update_settings(jsonb), public.dss_report(date, date, uuid, text) TO authenticated;
