-- DSS-M4 fix: broadcasts are deduplicated per appointment, so an account with several family members
-- booked today gets one notice per member (each named), still never twice for the same event.
CREATE OR REPLACE FUNCTION public._dss_notify_waiting(p_doctor uuid, p_type text, p_title text, p_body text, p_key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int := 0; a record;
BEGIN
  FOR a IN SELECT id FROM public.appointments
           WHERE doctor_id = p_doctor AND appointment_date = public.dss_today() AND status IN ('scheduled', 'checked_in') LOOP
    v_n := v_n + public._dss_notify_patient(a.id, p_type, p_title, p_body, NULL, p_key || ':' || a.id);
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public._dss_notify_waiting(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
