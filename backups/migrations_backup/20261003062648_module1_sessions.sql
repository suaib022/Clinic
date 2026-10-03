-- Session functions
CREATE OR REPLACE FUNCTION public.start_doctor_session(p_doctor_id uuid) RETURNS void AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  IF EXISTS (SELECT 1 FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND session_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date AND status != 'ended') THEN
    RAISE EXCEPTION 'Session already active for today';
  END IF;

  INSERT INTO public.doctor_sessions (doctor_id, session_date, started_at, status)
  VALUES (p_doctor_id, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka', 'open');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.pause_doctor_session(p_doctor_id uuid, p_reason text) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'No open session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'paused' WHERE id = v_session_id;
  INSERT INTO public.doctor_session_pauses (session_id, paused_at, reason) VALUES (v_session_id, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resume_doctor_session(p_doctor_id uuid) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status = 'paused';
  IF NOT FOUND THEN RAISE EXCEPTION 'No paused session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'open' WHERE id = v_session_id;
  UPDATE public.doctor_session_pauses SET resumed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE session_id = v_session_id AND resumed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.end_doctor_session(p_doctor_id uuid) RETURNS void AS $$
DECLARE
  v_role text;
  v_session_id uuid;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
  ELSIF v_role = 'doctor' AND p_doctor_id = auth.uid() THEN
  ELSE RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT id INTO v_session_id FROM public.doctor_sessions WHERE doctor_id = p_doctor_id AND status != 'ended';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session found'; END IF;

  UPDATE public.doctor_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE id = v_session_id;
  UPDATE public.doctor_session_pauses SET resumed_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka' WHERE session_id = v_session_id AND resumed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
