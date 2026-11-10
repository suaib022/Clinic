-- DSS-M5: staff snapshot also carries the patient's mobile number (front-desk search by UHID / mobile / serial).
-- Contact data only, never medical; omitted for the service-role (patient endpoint) caller as before.
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
                  'patient_uhid', CASE WHEN v_identity THEN p.uhid END,
                  'patient_mobile', CASE WHEN v_identity THEN p.mobile_no END) ORDER BY a.serial_no)
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


REVOKE ALL ON FUNCTION public.dss_snapshot_input(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dss_snapshot_input(uuid, date) TO authenticated, service_role;
