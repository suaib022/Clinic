-- Lab sample collection (Part 2): lines per test type, test orders, lab queues, counter sessions, report-ready, report review.
-- Written for the online database (users.role is the user_role enum there; lab staff use the existing value 'technician').
-- All writes go through SECURITY DEFINER functions (request keys, one lock per line per day, every action logged).

------------------------------------------------------------------------------
-- 1. Columns on existing tables
------------------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS visit_reason text NOT NULL DEFAULT 'consult';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_visit_reason_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_visit_reason_check CHECK (visit_reason IN ('consult', 'report_review'));
  END IF;
END $$;
-- One active consultation per patient, doctor and day stays the rule; a report review is a second, short visit the same day,
-- so it gets its own rule (at most one active report review per patient, doctor and day).
DROP INDEX IF EXISTS public.idx_patient_one_appt_per_doc_date;
CREATE UNIQUE INDEX idx_patient_one_appt_per_doc_date ON public.appointments (patient_id, doctor_id, appointment_date)
  WHERE status <> ALL (ARRAY['cancelled', 'no_show', 'completed']) AND visit_reason = 'consult';
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_one_review_per_doc_date ON public.appointments (patient_id, doctor_id, appointment_date)
  WHERE status <> ALL (ARRAY['cancelled', 'no_show', 'completed']) AND visit_reason = 'report_review';
ALTER TABLE public.dss_settings ADD COLUMN IF NOT EXISTS report_review_min integer NOT NULL DEFAULT 4
  CHECK (report_review_min BETWEEN 1 AND 30);

------------------------------------------------------------------------------
-- 2. Tables
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,30}$'),
  name text NOT NULL,
  typical_min numeric NOT NULL DEFAULT 4 CHECK (typical_min > 0 AND typical_min <= 120),
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_test_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name text NOT NULL,
  line_id uuid NOT NULL REFERENCES public.lab_lines(id),
  must_first boolean NOT NULL DEFAULT false,
  turnaround_min int NOT NULL DEFAULT 60 CHECK (turnaround_min BETWEEN 0 AND 10080),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.lab_lines(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'called', 'collected', 'cancelled')),
  priority_level smallint NOT NULL DEFAULT 0 CHECK (priority_level BETWEEN 0 AND 2),
  queued_at timestamptz NOT NULL DEFAULT now(),
  called_at timestamptz,
  collected_at timestamptz,
  skipped_at timestamptz,
  rejoined_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One active place per patient per line per day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_items_one_active
  ON public.lab_queue_items (line_id, patient_id, queue_date) WHERE status IN ('queued', 'called');
CREATE INDEX IF NOT EXISTS idx_lab_items_line_day ON public.lab_queue_items (line_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_lab_items_patient ON public.lab_queue_items (patient_id, queue_date);

CREATE TABLE IF NOT EXISTS public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_type_id uuid NOT NULL REFERENCES public.lab_test_types(id),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ordering_doctor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  external_prescriber text,
  ordered_by uuid,
  order_date date NOT NULL,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'queued', 'collected', 'report_ready', 'cancelled')),
  queue_item_id uuid REFERENCES public.lab_queue_items(id) ON DELETE SET NULL,
  collected_at timestamptz,
  report_ready_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ordering_doctor_id IS NOT NULL OR external_prescriber IS NOT NULL)
);
-- A test is ordered once per visit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_orders_once_per_visit
  ON public.lab_orders (appointment_id, test_type_id) WHERE appointment_id IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON public.lab_orders (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_item ON public.lab_orders (queue_item_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_day ON public.lab_orders (ordering_doctor_id, order_date);

CREATE TABLE IF NOT EXISTS public.lab_line_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.lab_lines(id),
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid,
  UNIQUE (line_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.lab_line_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lab_line_sessions(id) ON DELETE CASCADE,
  paused_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  reason text
);

CREATE TABLE IF NOT EXISTS public.lab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid REFERENCES public.lab_lines(id),
  queue_item_id uuid REFERENCES public.lab_queue_items(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.lab_orders(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_events_actor_request ON public.lab_events (actor_user_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_events_line_time ON public.lab_events (line_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lab_events_item ON public.lab_events (queue_item_id, occurred_at);

------------------------------------------------------------------------------
-- 3. Default lines and tests (admin can change them). Typical / turnaround minutes: see packages/flowq/scenarios/SOURCES.md
------------------------------------------------------------------------------
INSERT INTO public.lab_lines (code, name, typical_min, sort_order) VALUES
  ('blood', 'Blood collection', 3.3, 1), ('urine', 'Urine / stool', 2, 2), ('ecg', 'ECG', 6, 3), ('xray', 'X-ray', 4, 4)
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.lab_test_types (code, name, line_id, must_first, turnaround_min)
SELECT t.code, t.name, l.id, t.must_first, t.tat FROM (VALUES
  ('cbc', 'Complete blood count (CBC)', 'blood', false, 150),
  ('fbs', 'Fasting blood sugar', 'blood', true, 60),
  ('rbs', 'Random blood sugar', 'blood', false, 60),
  ('lipid', 'Lipid profile', 'blood', true, 150),
  ('creatinine', 'Serum creatinine', 'blood', false, 150),
  ('urine_re', 'Urine routine examination', 'urine', false, 60),
  ('stool_re', 'Stool routine examination', 'urine', false, 60),
  ('ecg', 'ECG (12-lead)', 'ecg', false, 0),
  ('cxr', 'Chest X-ray (PA view)', 'xray', false, 60)
) AS t(code, name, line, must_first, tat) JOIN public.lab_lines l ON l.code = t.line
ON CONFLICT (code) DO NOTHING;

------------------------------------------------------------------------------
-- 4. Helpers
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._lab_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'LAB_UNAUTHENTICATED: login required' USING ERRCODE = '28000'; END IF;
  RETURN public.get_user_role()::text;
END $$;

/** Lab counter actions: lab staff (technician) and admin. */
CREATE OR REPLACE FUNCTION public._lab_require_staff() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text := public._lab_role();
BEGIN
  IF v_role NOT IN ('admin', 'technician') THEN RAISE EXCEPTION 'LAB_FORBIDDEN: lab staff only' USING ERRCODE = '42501'; END IF;
  RETURN v_role;
END $$;

/** Lab staff, admin, or the doctor / their compounder for a hospital order. */
CREATE OR REPLACE FUNCTION public._lab_can_handle_order(p_doctor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role()::text IN ('admin', 'technician') OR (p_doctor IS NOT NULL AND public.dss_can_manage(p_doctor))
$$;

/** Idempotency + one writer per line per day. Returns the earlier result for a repeated request key. */
CREATE OR REPLACE FUNCTION public._lab_begin(p_lock text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev jsonb;
BEGIN
  IF p_request_key IS NULL OR length(p_request_key) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'LAB_BAD_INPUT: request key required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lab:' || p_lock), hashtext(public.dss_today()::text));
  SELECT metadata -> 'result' INTO v_prev FROM public.lab_events WHERE actor_user_id = auth.uid() AND request_key = p_request_key LIMIT 1;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('duplicate', true); END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._lab_log(
  p_line uuid, p_item uuid, p_order uuid, p_patient uuid, p_type text, p_role text, p_request_key text, p_meta jsonb, p_result jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.lab_events (line_id, queue_item_id, order_id, patient_id, event_type, actor_user_id, actor_role, request_key, metadata)
  VALUES (p_line, p_item, p_order, p_patient, p_type, auth.uid(), p_role, p_request_key,
          COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('result', p_result))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public._lab_result(p_ok boolean, p_code text, p_message text, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('ok', p_ok, 'code', p_code, 'message', p_message) || COALESCE(p_extra, '{}'::jsonb)
$$;

/** Opens today's counter session if there is none (first action of the day). */
CREATE OR REPLACE FUNCTION public._lab_session(p_line uuid) RETURNS public.lab_line_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.lab_line_sessions;
BEGIN
  SELECT * INTO s FROM public.lab_line_sessions WHERE line_id = p_line AND session_date = public.dss_today();
  IF s.id IS NULL THEN
    INSERT INTO public.lab_line_sessions (line_id, session_date, opened_by) VALUES (p_line, public.dss_today(), auth.uid()) RETURNING * INTO s;
  END IF;
  RETURN s;
END $$;

/** Puts orders in their lines' queues (one place per patient per line per day). Caller has checked access and locked. */
CREATE OR REPLACE FUNCTION public._lab_enqueue_orders(p_order_ids uuid[], p_role text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_item uuid; v_items jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT o.patient_id, t.line_id, array_agg(o.id) AS orders, array_agg(t.name) AS tests
    FROM public.lab_orders o JOIN public.lab_test_types t ON t.id = o.test_type_id
    WHERE o.id = ANY(p_order_ids) AND o.status = 'ordered'
    GROUP BY o.patient_id, t.line_id
  LOOP
    SELECT id INTO v_item FROM public.lab_queue_items
    WHERE line_id = r.line_id AND patient_id = r.patient_id AND queue_date = public.dss_today() AND status IN ('queued', 'called');
    IF v_item IS NULL THEN
      INSERT INTO public.lab_queue_items (line_id, patient_id, queue_date, created_by)
      VALUES (r.line_id, r.patient_id, public.dss_today(), auth.uid()) RETURNING id INTO v_item;
      PERFORM public._lab_log(r.line_id, v_item, NULL, r.patient_id, 'lab_queue', p_role, NULL,
        jsonb_build_object('tests', to_jsonb(r.tests), 'request', p_request_key), NULL);
    END IF;
    UPDATE public.lab_orders SET status = 'queued', queue_item_id = v_item WHERE id = ANY(r.orders);
    v_items := v_items || jsonb_build_object('item_id', v_item, 'line_id', r.line_id);
  END LOOP;
  RETURN v_items;
END $$;

------------------------------------------------------------------------------
-- 5. Ordering and queueing
------------------------------------------------------------------------------
/** Doctor (or their compounder) orders tests for a visit: during or after the consultation. */
CREATE OR REPLACE FUNCTION public.lab_order_tests(p_appointment_id uuid, p_test_type_ids uuid[], p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb; v_ids uuid[]; v_n int;
BEGIN
  v_role := public._lab_role();
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF a.id IS NULL OR NOT public.dss_can_manage(a.doctor_id) THEN
    RAISE EXCEPTION 'LAB_FORBIDDEN: not allowed for this visit' USING ERRCODE = '42501';
  END IF;
  IF p_test_type_ids IS NULL OR cardinality(p_test_type_ids) = 0 OR cardinality(p_test_type_ids) > 30 THEN
    RAISE EXCEPTION 'LAB_BAD_INPUT: choose 1-30 tests' USING ERRCODE = '22023';
  END IF;
  v_dup := public._lab_begin('appt:' || a.id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF a.status NOT IN ('in_consultation', 'prescription_pending', 'completed') THEN
    RETURN public._lab_result(false, 'stale', 'Tests can be ordered once the patient is with the doctor.');
  END IF;
  WITH ins AS (
    INSERT INTO public.lab_orders (patient_id, test_type_id, appointment_id, ordering_doctor_id, ordered_by, order_date)
    SELECT a.patient_id, t.id, a.id, a.doctor_id, auth.uid(), public.dss_today()
    FROM public.lab_test_types t WHERE t.id = ANY(p_test_type_ids) AND t.active
    ON CONFLICT (appointment_id, test_type_id) WHERE appointment_id IS NOT NULL AND status <> 'cancelled' DO NOTHING
    RETURNING id)
  SELECT array_agg(id) INTO v_ids FROM ins;
  v_n := COALESCE(cardinality(v_ids), 0);
  v_res := public._lab_result(true, 'ok', CASE WHEN v_n = 0 THEN 'These tests were already ordered.' ELSE format('%s test(s) ordered.', v_n) END,
           jsonb_build_object('order_ids', COALESCE(to_jsonb(v_ids), '[]'::jsonb)));
  PERFORM public._lab_log(NULL, NULL, NULL, a.patient_id, 'lab_order', v_role, p_request_key,
    jsonb_build_object('appointment_id', a.id, 'doctor_id', a.doctor_id, 'test_type_ids', to_jsonb(p_test_type_ids)), v_res);
  RETURN v_res;
END $$;

/** "Lab now" (compounder) or "queue a patient who came back" (lab staff): orders join their lines' queues. */
CREATE OR REPLACE FUNCTION public.lab_enqueue(p_order_ids uuid[], p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_patient uuid; v_bad int; v_items jsonb;
BEGIN
  v_role := public._lab_role();
  IF p_order_ids IS NULL OR cardinality(p_order_ids) = 0 THEN RAISE EXCEPTION 'LAB_BAD_INPUT: no orders' USING ERRCODE = '22023'; END IF;
  SELECT count(*) FILTER (WHERE NOT public._lab_can_handle_order(o.ordering_doctor_id)), min(o.patient_id::text)::uuid
  INTO v_bad, v_patient FROM public.lab_orders o WHERE o.id = ANY(p_order_ids);
  IF v_patient IS NULL OR v_bad > 0 THEN RAISE EXCEPTION 'LAB_FORBIDDEN: not allowed for these orders' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(DISTINCT patient_id) FROM public.lab_orders WHERE id = ANY(p_order_ids)) > 1 THEN
    RAISE EXCEPTION 'LAB_BAD_INPUT: orders of one patient at a time' USING ERRCODE = '22023';
  END IF;
  v_dup := public._lab_begin('patient:' || v_patient::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_orders WHERE id = ANY(p_order_ids) AND status = 'ordered') THEN
    RETURN public._lab_result(false, 'stale', 'Already in the lab queue.');
  END IF;
  v_items := public._lab_enqueue_orders(p_order_ids, v_role, p_request_key);
  v_res := public._lab_result(true, 'ok', 'Sent to the lab.', jsonb_build_object('items', v_items));
  PERFORM public._lab_log(NULL, NULL, NULL, v_patient, 'lab_enqueue', v_role, p_request_key,
    jsonb_build_object('order_ids', to_jsonb(p_order_ids)), v_res);
  RETURN v_res;
END $$;

/** Lab staff register a patient who brings a prescription from outside, and queue them. */
CREATE OR REPLACE FUNCTION public.lab_register_outside(p_patient_id uuid, p_test_type_ids uuid[], p_prescriber text, p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; v_ids uuid[]; v_items jsonb;
BEGIN
  v_role := public._lab_require_staff();
  IF p_test_type_ids IS NULL OR cardinality(p_test_type_ids) = 0 OR cardinality(p_test_type_ids) > 30
     OR p_prescriber IS NULL OR length(trim(p_prescriber)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'LAB_BAD_INPUT: tests and prescriber required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = p_patient_id) THEN RAISE EXCEPTION 'LAB_BAD_INPUT: patient not found' USING ERRCODE = '22023'; END IF;
  v_dup := public._lab_begin('patient:' || p_patient_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  WITH ins AS (
    INSERT INTO public.lab_orders (patient_id, test_type_id, external_prescriber, ordered_by, order_date)
    SELECT p_patient_id, t.id, trim(p_prescriber), auth.uid(), public.dss_today()
    FROM public.lab_test_types t WHERE t.id = ANY(p_test_type_ids) AND t.active
    RETURNING id)
  SELECT array_agg(id) INTO v_ids FROM ins;
  IF v_ids IS NULL THEN RAISE EXCEPTION 'LAB_BAD_INPUT: no active tests chosen' USING ERRCODE = '22023'; END IF;
  v_items := public._lab_enqueue_orders(v_ids, v_role, p_request_key);
  v_res := public._lab_result(true, 'ok', 'Registered and queued.', jsonb_build_object('order_ids', to_jsonb(v_ids), 'items', v_items));
  PERFORM public._lab_log(NULL, NULL, NULL, p_patient_id, 'lab_register_outside', v_role, p_request_key,
    jsonb_build_object('prescriber', trim(p_prescriber), 'test_type_ids', to_jsonb(p_test_type_ids)), v_res);
  RETURN v_res;
END $$;

------------------------------------------------------------------------------
-- 6. Counter (line) sessions
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lab_line_session(p_line_id uuid, p_action text, p_reason text, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; s public.lab_line_sessions; v_from text;
BEGIN
  v_role := public._lab_require_staff();
  IF p_action NOT IN ('open', 'pause', 'resume', 'close') THEN RAISE EXCEPTION 'LAB_BAD_INPUT: action' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_lines WHERE id = p_line_id) THEN RAISE EXCEPTION 'LAB_BAD_INPUT: line' USING ERRCODE = '22023'; END IF;
  v_dup := public._lab_begin('line:' || p_line_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  s := public._lab_session(p_line_id);
  v_from := s.status;
  IF p_action = 'open' THEN
    IF s.status = 'closed' THEN UPDATE public.lab_line_sessions SET status = 'open', closed_at = NULL WHERE id = s.id; END IF;
  ELSIF p_action = 'pause' THEN
    IF s.status <> 'open' THEN RETURN public._lab_result(false, 'stale', 'The counter is not open.'); END IF;
    UPDATE public.lab_line_sessions SET status = 'paused' WHERE id = s.id;
    INSERT INTO public.lab_line_pauses (session_id, reason) VALUES (s.id, NULLIF(trim(COALESCE(p_reason, '')), ''));
  ELSIF p_action = 'resume' THEN
    IF s.status <> 'paused' THEN RETURN public._lab_result(false, 'stale', 'The counter is not paused.'); END IF;
    UPDATE public.lab_line_sessions SET status = 'open' WHERE id = s.id;
    UPDATE public.lab_line_pauses SET resumed_at = now() WHERE session_id = s.id AND resumed_at IS NULL;
  ELSE
    IF EXISTS (SELECT 1 FROM public.lab_queue_items WHERE line_id = p_line_id AND queue_date = public.dss_today() AND status = 'called') THEN
      RETURN public._lab_result(false, 'busy', 'Finish the patient at the counter first.');
    END IF;
    UPDATE public.lab_line_pauses SET resumed_at = now() WHERE session_id = s.id AND resumed_at IS NULL;
    UPDATE public.lab_line_sessions SET status = 'closed', closed_at = now() WHERE id = s.id;
  END IF;
  v_res := public._lab_result(true, 'ok', CASE p_action WHEN 'open' THEN 'Counter open.' WHEN 'pause' THEN 'Counter paused.'
           WHEN 'resume' THEN 'Counter open again.' ELSE 'Counter closed.' END);
  PERFORM public._lab_log(p_line_id, NULL, NULL, NULL, 'line_' || p_action, v_role, p_request_key,
    jsonb_build_object('from', v_from, 'reason', p_reason), v_res);
  RETURN v_res;
END $$;

------------------------------------------------------------------------------
-- 7. Counter actions
------------------------------------------------------------------------------
/** Calls the next patient: emergency first, then priority, then by counted time (rejoin counts from the rejoin). */
CREATE OR REPLACE FUNCTION public.lab_call_next(p_line_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; s public.lab_line_sessions; i public.lab_queue_items; p record;
BEGIN
  v_role := public._lab_require_staff();
  v_dup := public._lab_begin('line:' || p_line_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  s := public._lab_session(p_line_id);
  IF s.status = 'paused' THEN RETURN public._lab_result(false, 'paused', 'The counter is paused. Resume first.'); END IF;
  IF s.status = 'closed' THEN UPDATE public.lab_line_sessions SET status = 'open', closed_at = NULL WHERE id = s.id; END IF;
  IF EXISTS (SELECT 1 FROM public.lab_queue_items WHERE line_id = p_line_id AND queue_date = public.dss_today() AND status = 'called') THEN
    RETURN public._lab_result(false, 'busy', 'Mark the patient at the counter as collected first.');
  END IF;
  SELECT * INTO i FROM public.lab_queue_items
  WHERE line_id = p_line_id AND queue_date = public.dss_today() AND status = 'queued' AND skipped_at IS NULL
  ORDER BY priority_level DESC, COALESCE(rejoined_at, queued_at), id LIMIT 1 FOR UPDATE;
  IF i.id IS NULL THEN RETURN public._lab_result(false, 'empty', 'Nobody is waiting.'); END IF;
  UPDATE public.lab_queue_items SET status = 'called', called_at = now() WHERE id = i.id;
  SELECT full_name, uhid INTO p FROM public.patients WHERE id = i.patient_id;
  v_res := public._lab_result(true, 'ok', format('Called %s.', p.full_name), jsonb_build_object('item_id', i.id));
  PERFORM public._lab_log(p_line_id, i.id, NULL, i.patient_id, 'lab_call', v_role, p_request_key, '{}'::jsonb, v_res);
  RETURN v_res;
END $$;

/** Sample taken. Tests with no turnaround (ECG) are ready at once. */
CREATE OR REPLACE FUNCTION public.lab_mark_collected(p_item_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; i public.lab_queue_items; v_ready uuid[];
BEGIN
  v_role := public._lab_require_staff();
  SELECT * INTO i FROM public.lab_queue_items WHERE id = p_item_id;
  IF i.id IS NULL THEN RAISE EXCEPTION 'LAB_BAD_INPUT: item' USING ERRCODE = '22023'; END IF;
  v_dup := public._lab_begin('line:' || i.line_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO i FROM public.lab_queue_items WHERE id = p_item_id;
  IF i.status <> 'called' THEN RETURN public._lab_result(false, 'stale', 'Already updated by someone else.'); END IF;
  UPDATE public.lab_queue_items SET status = 'collected', collected_at = now() WHERE id = i.id;
  UPDATE public.lab_orders SET status = 'collected', collected_at = now() WHERE queue_item_id = i.id AND status = 'queued';
  WITH r AS (
    UPDATE public.lab_orders o SET status = 'report_ready', report_ready_at = now()
    FROM public.lab_test_types t WHERE t.id = o.test_type_id AND o.queue_item_id = i.id AND o.status = 'collected' AND t.turnaround_min = 0
    RETURNING o.id)
  SELECT array_agg(id) INTO v_ready FROM r;
  v_res := public._lab_result(true, 'ok', 'Sample collected.', jsonb_build_object('item_id', i.id, 'ready_order_ids', COALESCE(to_jsonb(v_ready), '[]'::jsonb)));
  PERFORM public._lab_log(i.line_id, i.id, NULL, i.patient_id, 'sample_collected', v_role, p_request_key,
    jsonb_build_object('auto_ready', COALESCE(to_jsonb(v_ready), '[]'::jsonb)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.lab_skip(p_item_id uuid, p_rejoin boolean, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; i public.lab_queue_items;
BEGIN
  v_role := public._lab_require_staff();
  SELECT * INTO i FROM public.lab_queue_items WHERE id = p_item_id;
  IF i.id IS NULL THEN RAISE EXCEPTION 'LAB_BAD_INPUT: item' USING ERRCODE = '22023'; END IF;
  v_dup := public._lab_begin('line:' || i.line_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO i FROM public.lab_queue_items WHERE id = p_item_id;
  IF i.status <> 'queued' OR (NOT p_rejoin AND i.skipped_at IS NOT NULL) OR (p_rejoin AND i.skipped_at IS NULL) THEN
    RETURN public._lab_result(false, 'stale', 'Already updated by someone else.');
  END IF;
  IF p_rejoin THEN UPDATE public.lab_queue_items SET skipped_at = NULL, rejoined_at = now() WHERE id = i.id;
  ELSE UPDATE public.lab_queue_items SET skipped_at = now() WHERE id = i.id; END IF;
  v_res := public._lab_result(true, 'ok', CASE WHEN p_rejoin THEN 'Back in line.' ELSE 'Skipped for now.' END, jsonb_build_object('item_id', i.id));
  PERFORM public._lab_log(i.line_id, i.id, NULL, i.patient_id, CASE WHEN p_rejoin THEN 'lab_rejoin' ELSE 'lab_skip' END, v_role, p_request_key,
    jsonb_build_object('prev', jsonb_build_object('skipped_at', i.skipped_at, 'rejoined_at', i.rejoined_at)), v_res);
  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.lab_mark_report_ready(p_order_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; o public.lab_orders; v_line uuid; v_test text;
BEGIN
  v_role := public._lab_require_staff();
  SELECT * INTO o FROM public.lab_orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'LAB_BAD_INPUT: order' USING ERRCODE = '22023'; END IF;
  SELECT line_id, name INTO v_line, v_test FROM public.lab_test_types WHERE id = o.test_type_id;
  v_dup := public._lab_begin('line:' || v_line::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT * INTO o FROM public.lab_orders WHERE id = p_order_id;
  IF o.status <> 'collected' THEN RETURN public._lab_result(false, 'stale', 'This report is not waiting.'); END IF;
  UPDATE public.lab_orders SET status = 'report_ready', report_ready_at = now() WHERE id = o.id;
  INSERT INTO public.patient_notifications (patient_id, appointment_id, type, title, message, metadata)
  VALUES (o.patient_id, o.appointment_id, 'lab_report_ready', 'Lab report ready', format('Your %s report is ready.', v_test),
          jsonb_build_object('order_id', o.id));
  v_res := public._lab_result(true, 'ok', format('%s report ready.', v_test), jsonb_build_object('order_id', o.id));
  PERFORM public._lab_log(v_line, o.queue_item_id, o.id, o.patient_id, 'report_ready', v_role, p_request_key, '{}'::jsonb, v_res);
  RETURN v_res;
END $$;

/** Undo your own last counter action on this line within the undo window (same rule as the doctor queue). */
CREATE OR REPLACE FUNCTION public.lab_undo(p_line_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_dup jsonb; v_res jsonb; e public.lab_events; v_window int;
BEGIN
  v_role := public._lab_require_staff();
  v_dup := public._lab_begin('line:' || p_line_id::text, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  SELECT undo_window_sec INTO v_window FROM public.dss_settings WHERE id = 1;
  SELECT * INTO e FROM public.lab_events q
  WHERE q.line_id = p_line_id AND q.actor_user_id = auth.uid() AND q.request_key IS NOT NULL
    AND q.event_type IN ('lab_call', 'sample_collected', 'lab_skip', 'lab_rejoin', 'report_ready')
    AND (q.metadata -> 'result' ->> 'ok')::boolean
    AND q.occurred_at > now() - make_interval(secs => COALESCE(v_window, 120))
    AND NOT EXISTS (SELECT 1 FROM public.lab_events u WHERE u.event_type = 'undo' AND u.metadata ->> 'undo_of' = q.id::text)
  ORDER BY q.occurred_at DESC LIMIT 1;
  IF e.id IS NULL THEN RETURN public._lab_result(false, 'nothing', 'Nothing to undo.'); END IF;
  -- Only the newest action on that patient's place can be undone.
  IF EXISTS (SELECT 1 FROM public.lab_events l WHERE l.queue_item_id = e.queue_item_id AND l.occurred_at > e.occurred_at AND l.event_type <> 'undo') THEN
    RETURN public._lab_result(false, 'stale', 'Something else happened since. It cannot be undone.');
  END IF;
  CASE e.event_type
    WHEN 'lab_call' THEN
      UPDATE public.lab_queue_items SET status = 'queued', called_at = NULL WHERE id = e.queue_item_id AND status = 'called';
    WHEN 'sample_collected' THEN
      UPDATE public.lab_queue_items SET status = 'called', collected_at = NULL WHERE id = e.queue_item_id AND status = 'collected';
      UPDATE public.lab_orders SET status = 'queued', collected_at = NULL, report_ready_at = NULL
      WHERE queue_item_id = e.queue_item_id AND status IN ('collected', 'report_ready');
    WHEN 'lab_skip', 'lab_rejoin' THEN
      UPDATE public.lab_queue_items SET skipped_at = NULLIF(e.metadata -> 'prev' ->> 'skipped_at', '')::timestamptz,
        rejoined_at = NULLIF(e.metadata -> 'prev' ->> 'rejoined_at', '')::timestamptz WHERE id = e.queue_item_id;
    WHEN 'report_ready' THEN
      UPDATE public.lab_orders SET status = 'collected', report_ready_at = NULL WHERE id = e.order_id AND status = 'report_ready';
  END CASE;
  v_res := public._lab_result(true, 'ok', 'Undone.', jsonb_build_object('undone_type', e.event_type, 'undo_of', e.id));
  PERFORM public._lab_log(p_line_id, e.queue_item_id, e.order_id, e.patient_id, 'undo', v_role, p_request_key,
    jsonb_build_object('undo_of', e.id::text, 'undone_type', e.event_type), v_res);
  RETURN v_res;
END $$;

------------------------------------------------------------------------------
-- 8. Report review: back to the same doctor today with the report (compounder taps it after the return advice)
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dss_return_for_review(p_appointment_id uuid, p_request_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; v_role text; v_dup jsonb; v_res jsonb; v_session text; v_serial int; v_slot int; v_id uuid;
  v_now_t time := (now() AT TIME ZONE 'Asia/Dhaka')::time;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  v_role := public._dss_require(a.doctor_id);
  v_dup := public._dss_begin(a.doctor_id, p_request_key);
  IF v_dup IS NOT NULL THEN RETURN v_dup; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_orders WHERE appointment_id = a.id AND status = 'report_ready') THEN
    RETURN public._dss_result(false, 'not_ready', 'No report is ready for this visit yet.');
  END IF;
  SELECT status INTO v_session FROM public.doctor_sessions WHERE doctor_id = a.doctor_id AND session_date = public.dss_today()
  ORDER BY (status <> 'ended') DESC, created_at DESC LIMIT 1;
  IF v_session IS NULL OR v_session = 'ended' THEN
    RETURN public._dss_result(false, 'session_ended', 'The doctor is not seeing patients now. Book a later visit.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE patient_id = a.patient_id AND doctor_id = a.doctor_id AND appointment_date = public.dss_today()
             AND visit_reason = 'report_review' AND status NOT IN ('cancelled', 'no_show', 'completed')) THEN
    RETURN public._dss_result(false, 'stale', 'This patient is already in line for a report review.');
  END IF;
  v_slot := COALESCE(a.slot_minutes, (SELECT default_slot_min FROM public.dss_settings WHERE id = 1), 10);
  SELECT COALESCE(MAX(serial_no), 0) + 1 INTO v_serial FROM public.appointments WHERE doctor_id = a.doctor_id AND appointment_date = public.dss_today();
  INSERT INTO public.appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, serial_no, scheduled_start,
    slot_minutes, visit_type, visit_reason, priority_level, visit_source, created_by_user_id, checked_in_at, status_changed_by, status_changed_at)
  VALUES (a.patient_id, a.doctor_id, public.dss_today(), v_now_t, v_now_t + make_interval(mins => v_slot), 'checked_in', v_serial, now(),
    v_slot, 'follow_up', 'report_review', 0, 'walk_in', auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_id;
  v_res := public._dss_result(true, 'ok', format('Report review added as serial %s.', v_serial),
           jsonb_build_object('appointment_id', v_id, 'serial_no', v_serial, 'first_visit_id', a.id));
  PERFORM public._dss_log(a.doctor_id, v_id, 'return_queue', NULL, 'checked_in', v_role, p_request_key,
    jsonb_build_object('serial_no', v_serial, 'first_visit_id', a.id), v_res);
  RETURN v_res;
END $$;

------------------------------------------------------------------------------
-- 9. Reads
------------------------------------------------------------------------------
/** Everything the lab screen and the engine need for one line and day. Names only for lab staff and admin. */
CREATE OR REPLACE FUNCTION public.lab_snapshot_input(p_line_id uuid, p_date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_date date := COALESCE(p_date, public.dss_today()); v_identity boolean; v_out jsonb;
BEGIN
  -- The service role (used only by the patient endpoint after an ownership check) gets the line without any names.
  IF auth.role() = 'service_role' THEN
    v_identity := false;
  ELSE
    v_role := public._lab_role();
    IF v_role NOT IN ('admin', 'technician', 'doctor', 'compounder') THEN RAISE EXCEPTION 'LAB_FORBIDDEN: staff only' USING ERRCODE = '42501'; END IF;
    v_identity := v_role IN ('admin', 'technician');
  END IF;
  SELECT jsonb_build_object(
    'server_now', now(),
    'date', v_date,
    'settings', (SELECT to_jsonb(st) - 'id' - 'updated_by' FROM public.dss_settings st WHERE id = 1),
    'line', jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name, 'typical_min', l.typical_min),
    'session', (SELECT jsonb_build_object('id', s.id, 'status', s.status, 'opened_at', s.opened_at, 'closed_at', s.closed_at,
                  'pauses', COALESCE((SELECT jsonb_agg(jsonb_build_object('paused_at', p.paused_at, 'resumed_at', p.resumed_at, 'reason', p.reason) ORDER BY p.paused_at)
                                      FROM public.lab_line_pauses p WHERE p.session_id = s.id), '[]'::jsonb))
                FROM public.lab_line_sessions s WHERE s.line_id = l.id AND s.session_date = v_date),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'id', i.id, 'patient_id', i.patient_id, 'status', i.status, 'priority_level', i.priority_level,
                  'queued_at', i.queued_at, 'called_at', i.called_at, 'collected_at', i.collected_at,
                  'skipped_at', i.skipped_at, 'rejoined_at', i.rejoined_at,
                  'patient_name', CASE WHEN v_identity THEN pt.full_name END,
                  'patient_uhid', CASE WHEN v_identity THEN pt.uhid END,
                  'tests', (SELECT jsonb_agg(jsonb_build_object('order_id', o.id, 'name', t.name, 'status', o.status) ORDER BY t.name)
                            FROM public.lab_orders o JOIN public.lab_test_types t ON t.id = o.test_type_id WHERE o.queue_item_id = i.id),
                  -- Other lines this patient still has to visit today (for the routing suggestion).
                  'other_lines', (SELECT jsonb_agg(DISTINCT jsonb_build_object('line_id', t2.line_id, 'must_first', t2.must_first))
                            FROM public.lab_orders o2 JOIN public.lab_test_types t2 ON t2.id = o2.test_type_id
                            WHERE o2.patient_id = i.patient_id AND t2.line_id <> l.id
                              AND (o2.status = 'ordered' AND o2.order_date = v_date
                                   OR o2.status = 'queued' AND EXISTS (SELECT 1 FROM public.lab_queue_items q2 WHERE q2.id = o2.queue_item_id AND q2.queue_date = v_date))))
                ORDER BY i.queued_at)
              FROM public.lab_queue_items i JOIN public.patients pt ON pt.id = i.patient_id
              WHERE i.line_id = l.id AND i.queue_date = v_date AND i.status <> 'cancelled'), '[]'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(d) FROM (SELECT round(extract(epoch FROM (h.collected_at - h.called_at)) / 60.0, 2) AS d
                 FROM public.lab_queue_items h WHERE h.line_id = l.id AND h.status = 'collected' AND h.called_at IS NOT NULL
                   AND h.collected_at > h.called_at AND h.collected_at - h.called_at < interval '2 hours'
                 ORDER BY h.collected_at DESC LIMIT 200) x), '[]'::jsonb),
    'my_undo', CASE WHEN v_identity THEN (SELECT jsonb_build_object('event_id', q.id, 'type', q.event_type, 'at', q.occurred_at,
                  'message', q.metadata -> 'result' ->> 'message')
                FROM public.lab_events q
                WHERE q.line_id = l.id AND q.actor_user_id = auth.uid() AND q.request_key IS NOT NULL
                  AND q.event_type IN ('lab_call', 'sample_collected', 'lab_skip', 'lab_rejoin', 'report_ready')
                  AND (q.metadata -> 'result' ->> 'ok')::boolean
                  AND q.occurred_at > now() - make_interval(secs => (SELECT undo_window_sec FROM public.dss_settings WHERE id = 1))
                  AND NOT EXISTS (SELECT 1 FROM public.lab_events u WHERE u.event_type = 'undo' AND u.metadata ->> 'undo_of' = q.id::text)
                ORDER BY q.occurred_at DESC LIMIT 1) END
  ) INTO v_out
  FROM public.lab_lines l WHERE l.id = p_line_id;
  RETURN v_out;
END $$;

/** Lab staff: a patient's open orders (ordered but not yet queued, any day) and today's reports waiting to be marked ready. */
CREATE OR REPLACE FUNCTION public.lab_patient_orders(p_patient_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._lab_require_staff();
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('order_id', o.id, 'test', t.name, 'line_id', t.line_id, 'status', o.status,
            'order_date', o.order_date, 'doctor', u.full_name, 'external_prescriber', o.external_prescriber) ORDER BY o.created_at)
          FROM public.lab_orders o JOIN public.lab_test_types t ON t.id = o.test_type_id LEFT JOIN public.users u ON u.id = o.ordering_doctor_id
          WHERE o.patient_id = p_patient_id AND o.status IN ('ordered', 'queued', 'collected')), '[]'::jsonb);
END $$;

/**
 * Lab staff find a patient by exact UHID or mobile (same rule as the compounder lookup: no name search, at most 5 rows),
 * rate-limited to 60 lookups per 15 minutes and logged (query stored as a hash only).
 */
CREATE OR REPLACE FUNCTION public.lab_find_patient(p_query text) RETURNS TABLE (id uuid, full_name text, uhid text, gender text, mobile_tail text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_q text := trim(COALESCE(p_query, '')); v_n int;
BEGIN
  v_role := public._lab_require_staff();
  IF length(v_q) NOT BETWEEN 4 AND 40 THEN RAISE EXCEPTION 'LAB_BAD_INPUT: enter a UHID or mobile number' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.lab_events WHERE actor_user_id = auth.uid() AND event_type = 'patient_lookup'
      AND occurred_at > now() - interval '15 minutes') >= 60 THEN
    RAISE EXCEPTION 'LAB_RATE_LIMIT: too many lookups, try again later' USING ERRCODE = '54000';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.uhid, p.gender, right(p.mobile_no, 3)
  FROM public.patients p
  WHERE p.uhid = v_q OR p.mobile_no = v_q OR p.mobile_no = '+88' || v_q OR p.mobile_no = '+880' || substring(v_q from 2)
  LIMIT 5;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.lab_events (event_type, actor_user_id, actor_role, metadata)
  VALUES ('patient_lookup', auth.uid(), v_role, jsonb_build_object('query_hash', md5(v_q), 'results', v_n));
END $$;

/** Lab staff: samples collected and waiting for their report (oldest first), with the expected ready time. */
CREATE OR REPLACE FUNCTION public.lab_pending_reports() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._lab_require_staff();
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('order_id', o.id, 'test', t.name, 'line_id', t.line_id, 'patient_name', p.full_name,
            'patient_uhid', p.uhid, 'collected_at', o.collected_at,
            'expected_ready_at', o.collected_at + make_interval(mins => t.turnaround_min), 'doctor', u.full_name) ORDER BY o.collected_at)
          FROM public.lab_orders o JOIN public.lab_test_types t ON t.id = o.test_type_id JOIN public.patients p ON p.id = o.patient_id
          LEFT JOIN public.users u ON u.id = o.ordering_doctor_id
          WHERE o.status = 'collected'), '[]'::jsonb);
END $$;

/**
 * Doctor / compounder: today's visits of this doctor that have lab orders, for "Lab now / Later" and the report-review offer.
 * One row per first visit: tests with status, whether a report review is already in line, and the patient's name (staff only).
 */
CREATE OR REPLACE FUNCTION public.lab_doctor_status(p_doctor_id uuid, p_date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_date date := COALESCE(p_date, public.dss_today());
BEGIN
  PERFORM public._dss_require(p_doctor_id);
  RETURN COALESCE((SELECT jsonb_agg(v ORDER BY v ->> 'serial_no') FROM (
    SELECT jsonb_build_object(
      'appointment_id', a.id, 'serial_no', a.serial_no, 'status', a.status, 'patient_name', p.full_name, 'patient_uhid', p.uhid,
      'tests', (SELECT jsonb_agg(jsonb_build_object('order_id', o.id, 'name', t.name, 'line_id', t.line_id, 'status', o.status,
                  'turnaround_min', t.turnaround_min, 'collected_at', o.collected_at, 'report_ready_at', o.report_ready_at) ORDER BY t.name)
                FROM public.lab_orders o JOIN public.lab_test_types t ON t.id = o.test_type_id
                WHERE o.appointment_id = a.id AND o.status <> 'cancelled'),
      'review_appointment_id', (SELECT r.id FROM public.appointments r WHERE r.patient_id = a.patient_id AND r.doctor_id = a.doctor_id
                AND r.appointment_date = v_date AND r.visit_reason = 'report_review' AND r.status NOT IN ('cancelled', 'no_show')
                ORDER BY r.created_at DESC LIMIT 1)) AS v
    FROM public.appointments a JOIN public.patients p ON p.id = a.patient_id
    WHERE a.doctor_id = p_doctor_id AND a.appointment_date = v_date AND a.visit_reason = 'consult'
      AND EXISTS (SELECT 1 FROM public.lab_orders o WHERE o.appointment_id = a.id AND o.status <> 'cancelled')) x), '[]'::jsonb);
END $$;

------------------------------------------------------------------------------
-- 10. Row-level security: read for staff (and patients for their own); every write goes through the functions above
------------------------------------------------------------------------------
ALTER TABLE public.lab_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_line_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_line_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_lines_read ON public.lab_lines;
CREATE POLICY lab_lines_read ON public.lab_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lab_lines_admin ON public.lab_lines;
CREATE POLICY lab_lines_admin ON public.lab_lines FOR ALL TO authenticated
  USING (public.get_user_role()::text = 'admin') WITH CHECK (public.get_user_role()::text = 'admin');
DROP POLICY IF EXISTS lab_tests_read ON public.lab_test_types;
CREATE POLICY lab_tests_read ON public.lab_test_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lab_tests_admin ON public.lab_test_types;
CREATE POLICY lab_tests_admin ON public.lab_test_types FOR ALL TO authenticated
  USING (public.get_user_role()::text = 'admin') WITH CHECK (public.get_user_role()::text = 'admin');

DROP POLICY IF EXISTS lab_orders_read ON public.lab_orders;
CREATE POLICY lab_orders_read ON public.lab_orders FOR SELECT TO authenticated USING (
  public.get_user_role()::text IN ('admin', 'technician')
  OR (ordering_doctor_id IS NOT NULL AND public.dss_can_manage(ordering_doctor_id))
  OR patient_id IN (SELECT p.id FROM public.patients p WHERE p.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS lab_items_read ON public.lab_queue_items;
CREATE POLICY lab_items_read ON public.lab_queue_items FOR SELECT TO authenticated USING (
  public.get_user_role()::text IN ('admin', 'technician', 'doctor', 'compounder')
  OR patient_id IN (SELECT p.id FROM public.patients p WHERE p.auth_user_id = auth.uid()));
DROP POLICY IF EXISTS lab_sessions_read ON public.lab_line_sessions;
CREATE POLICY lab_sessions_read ON public.lab_line_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lab_pauses_read ON public.lab_line_pauses;
CREATE POLICY lab_pauses_read ON public.lab_line_pauses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lab_events_read ON public.lab_events;
CREATE POLICY lab_events_read ON public.lab_events FOR SELECT TO authenticated USING (public.get_user_role()::text IN ('admin', 'technician'));

------------------------------------------------------------------------------
-- 11. Grants: deny by default, open the public lab API to logged-in users (each function re-checks the role)
------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'lab\_%' OR p.proname LIKE '\_lab\_%' OR p.proname = 'dss_return_for_review')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION
  public.lab_order_tests(uuid, uuid[], text),
  public.lab_enqueue(uuid[], text),
  public.lab_register_outside(uuid, uuid[], text, text),
  public.lab_line_session(uuid, text, text, text),
  public.lab_call_next(uuid, text),
  public.lab_mark_collected(uuid, text),
  public.lab_skip(uuid, boolean, text),
  public.lab_mark_report_ready(uuid, text),
  public.lab_undo(uuid, text),
  public.lab_snapshot_input(uuid, date),
  public.lab_patient_orders(uuid),
  public.lab_find_patient(text),
  public.lab_pending_reports(),
  public.lab_doctor_status(uuid, date),
  public.dss_return_for_review(uuid, text)
TO authenticated;
-- Used inside RLS policies, which run as the caller.
GRANT EXECUTE ON FUNCTION public._lab_can_handle_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lab_snapshot_input(uuid, date) TO service_role;

------------------------------------------------------------------------------
-- 12. Live updates for the lab screens
------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['lab_queue_items', 'lab_orders', 'lab_line_sessions'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

------------------------------------------------------------------------------
-- 13. Doctor queue snapshot: adds visit_reason, and report reviews no longer count in the doctor's visit-length history.
--     Same function as dss_m5_snapshot_mobile otherwise (checked identical to the online version on 2026-11-18).
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
                 ORDER BY COALESCE(l.consult_ended_at, l.created_at) DESC LIMIT 30) h), '[]'::jsonb),
       'follow_up', COALESCE((SELECT jsonb_agg(d) FROM (SELECT l.consult_duration_minutes AS d FROM public.consultation_analytics_logs l
                 WHERE l.doctor_id = p_doctor_id
                   AND NOT EXISTS (SELECT 1 FROM public.appointments rr WHERE rr.id = l.appointment_id AND rr.visit_reason = 'report_review') AND l.visit_type = 'follow_up' AND l.consult_duration_minutes BETWEEN 1 AND 120
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