-- Feedback DB tests. Run against local Supabase:
--   docker exec -i supabase_db_Clinic psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < tests/db/feedback.sql
-- Fixtures are inserted as superuser, then each check impersonates a user with RLS on.
-- Any failed assert raises and stops the script (ON_ERROR_STOP).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN RAISE EXCEPTION 'ASSERT FAILED: %', msg; END IF;
  RAISE NOTICE 'ok: %', msg;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.as_user(uid uuid, role_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
END $$;

-- Fixture ids
\set pa '11111111-1111-1111-1111-111111111111'
\set pb '22222222-2222-2222-2222-222222222222'
\set doc1 '33333333-3333-3333-3333-333333333333'
\set doc2 '44444444-4444-4444-4444-444444444444'
\set tech '55555555-5555-5555-5555-555555555555'

-- Auth users (minimal columns)
INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id)
VALUES
 (:'pa', 'pa@test.local', 'authenticated', 'authenticated', '', '{}', '{}', now(), now(), '00000000-0000-0000-0000-000000000000'),
 (:'pb', 'pb@test.local', 'authenticated', 'authenticated', '', '{}', '{}', now(), now(), '00000000-0000-0000-0000-000000000000'),
 (:'doc1', 'd1@test.local', 'authenticated', 'authenticated', '', '{}', '{}', now(), now(), '00000000-0000-0000-0000-000000000000'),
 (:'doc2', 'd2@test.local', 'authenticated', 'authenticated', '', '{}', '{}', now(), now(), '00000000-0000-0000-0000-000000000000'),
 (:'tech', 't@test.local', 'authenticated', 'authenticated', '', '{}', '{}', now(), now(), '00000000-0000-0000-0000-000000000000');

-- Public users (role column drives get_user_role)
INSERT INTO public.users (id, email, role, full_name)
VALUES
 (:'pa', 'pa@test.local', 'patient', 'Pat A'),
 (:'pb', 'pb@test.local', 'patient', 'Pat B'),
 (:'doc1', 'd1@test.local', 'doctor', 'Doc One'),
 (:'doc2', 'd2@test.local', 'doctor', 'Doc Two'),
 (:'tech', 't@test.local', 'technician', 'Tech')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

-- Patients rows keyed to the same ids, linked to auth
INSERT INTO public.patients (id, auth_user_id, full_name, mobile_no, uhid)
VALUES
 (:'pa', :'pa', 'Pat A', '01000000001', 'UHID-A'),
 (:'pb', :'pb', 'Pat B', '01000000002', 'UHID-B')
ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

-- Completed visit for patient A with doctor 1 (today)
INSERT INTO public.appointments (id, patient_id, doctor_id, appointment_date, start_time, end_time, status, consult_started_at, consult_ended_at)
VALUES
 ('66666666-6666-6666-6666-666666666666', :'pa', :'doc1', CURRENT_DATE, '09:00', '09:15', 'completed', now(), now());

-- Lab fixtures
INSERT INTO public.lab_lines (id, code, name) VALUES ('77777777-7777-7777-7777-777777777777', 'tst_line', 'Test line');
INSERT INTO public.lab_test_types (id, line_id, code, name)
VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'cbc_test', 'CBC');
INSERT INTO public.lab_orders (id, patient_id, test_type_id, order_date, status, report_ready_at, external_prescriber)
VALUES
 ('99999999-9999-9999-9999-999999999991', :'pa', '88888888-8888-8888-8888-888888888888', CURRENT_DATE, 'report_ready', now(), 'Ext Dr'),
 ('99999999-9999-9999-9999-999999999992', :'pa', '88888888-8888-8888-8888-888888888888', CURRENT_DATE, 'ordered', NULL, 'Ext Dr');

-- 1. CHECK rejects unknown category
DO $$ BEGIN
  BEGIN
    INSERT INTO public.appointment_feedbacks (appointment_id, patient_id, doctor_id, doctor_rating, service_rating, visit_date, categories)
    VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 4, 4, CURRENT_DATE, ARRAY['foo']::text[]);
    PERFORM pg_temp.assert_true(false, 'unknown category must be rejected');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.assert_true(true, 'unknown category rejected by CHECK');
  END;
END $$;

-- 2. Patient A submits doctor feedback via RPC (typed)
SELECT pg_temp.as_user(:'pa', 'authenticated');
SELECT public.submit_appointment_feedback('66666666-6666-6666-6666-666666666666', 5, 4, 'Great doctor', '{}'::jsonb, 'typed') IS NOT NULL AS ok \gset
RESET ROLE;
SELECT pg_temp.assert_true(:'ok'::boolean, 'patient A submits doctor feedback');

-- 3. Second submit for same visit rejected
SELECT pg_temp.as_user(:'pa', 'authenticated');
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_appointment_feedback('66666666-6666-6666-6666-666666666666', 3, 3, 'again', '{}'::jsonb, 'typed');
    PERFORM pg_temp.assert_true(false, 'duplicate doctor feedback must be rejected');
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert_true(true, 'duplicate doctor feedback rejected');
  END;
END $$;
RESET ROLE;

-- 4. Patient B cannot submit for patient A's visit
SELECT pg_temp.as_user(:'pb', 'authenticated');
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_appointment_feedback('66666666-6666-6666-6666-666666666666', 1, 1, 'x', '{}'::jsonb, 'typed');
    PERFORM pg_temp.assert_true(false, 'other patient must not submit');
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert_true(true, 'other patient blocked from submit');
  END;
END $$;
RESET ROLE;

-- 5. Invalid input method rejected
SELECT pg_temp.as_user(:'pa', 'authenticated');
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_appointment_feedback('66666666-6666-6666-6666-666666666666', 5, 4, NULL, '{}'::jsonb, 'shout');
    PERFORM pg_temp.assert_true(false, 'bad input_method must be rejected');
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert_true(true, 'bad input_method rejected');
  END;
END $$;
RESET ROLE;

-- 6. Doctor 1 sees own feedback, doctor 2 does not
SELECT pg_temp.as_user(:'doc1', 'authenticated');
SELECT count(*) AS d1_seen FROM public.appointment_feedbacks \gset
RESET ROLE;
SELECT pg_temp.as_user(:'doc2', 'authenticated');
SELECT count(*) AS d2_seen FROM public.appointment_feedbacks \gset
RESET ROLE;
SELECT pg_temp.assert_true(:'d1_seen'::int = 1, 'doctor 1 sees own feedback');
SELECT pg_temp.assert_true(:'d2_seen'::int = 0, 'doctor 2 sees none of doctor 1 feedback');

-- 7. Lab: order not ready -> rejected
SELECT pg_temp.as_user(:'pa', 'authenticated');
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_lab_feedback('99999999-9999-9999-9999-999999999992', 4, 4, 'x', 'typed');
    PERFORM pg_temp.assert_true(false, 'lab feedback before report_ready must be rejected');
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert_true(true, 'lab feedback before report_ready rejected');
  END;
END $$;
RESET ROLE;

-- 8. Lab: ready order, patient A submits; second submit rejected
SELECT pg_temp.as_user(:'pa', 'authenticated');
SELECT public.submit_lab_feedback('99999999-9999-9999-9999-999999999991', 4, 5, 'Quick', 'voice') IS NOT NULL AS lab_ok \gset
SELECT pg_temp.assert_true(:'lab_ok'::boolean, 'patient A submits lab feedback');
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_lab_feedback('99999999-9999-9999-9999-999999999991', 1, 1, 'again', 'typed');
    PERFORM pg_temp.assert_true(false, 'duplicate lab feedback must be rejected');
  EXCEPTION WHEN raise_exception THEN
    PERFORM pg_temp.assert_true(true, 'duplicate lab feedback rejected');
  END;
END $$;
RESET ROLE;

-- 9. Lab RLS: technician sees lab feedback, doctor and patient B do not
SELECT pg_temp.as_user(:'tech', 'authenticated');
SELECT count(*) AS t_seen FROM public.lab_feedbacks \gset
RESET ROLE;
SELECT pg_temp.as_user(:'doc1', 'authenticated');
SELECT count(*) AS doc_lab_seen FROM public.lab_feedbacks \gset
RESET ROLE;
SELECT pg_temp.as_user(:'pb', 'authenticated');
SELECT count(*) AS pb_lab_seen FROM public.lab_feedbacks \gset
RESET ROLE;
SELECT pg_temp.assert_true(:'t_seen'::int = 1, 'technician sees lab feedback');
SELECT pg_temp.assert_true(:'doc_lab_seen'::int = 0, 'doctor does not see lab feedback');
SELECT pg_temp.assert_true(:'pb_lab_seen'::int = 0, 'other patient does not see lab feedback');

-- 10. Classifier writer: service role only
DO $$ BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.set_feedback_classification('appointment', '00000000-0000-0000-0000-000000000000', ARRAY['positive'], 'positive');
    PERFORM pg_temp.assert_true(false, 'authenticated must not call classifier writer');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.assert_true(true, 'authenticated blocked from classifier writer');
  END;
END $$;
RESET ROLE;

-- 11. Classifier writer works for service role and stores categories (both kinds)
SET LOCAL ROLE service_role;
SELECT public.set_feedback_classification('lab', (SELECT id FROM public.lab_feedbacks LIMIT 1), ARRAY['staff','negative'], 'negative');
SELECT public.set_feedback_classification('appointment', (SELECT id FROM public.appointment_feedbacks LIMIT 1), ARRAY['positive'], 'positive');
RESET ROLE;
SELECT (categories = ARRAY['staff','negative']::text[] AND classified_at IS NOT NULL) AS lab_cls FROM public.lab_feedbacks LIMIT 1 \gset
SELECT (categories = ARRAY['positive']::text[] AND classified_at IS NOT NULL) AS appt_cls FROM public.appointment_feedbacks LIMIT 1 \gset
SELECT pg_temp.assert_true(:'lab_cls'::boolean, 'service role stores lab categories');
SELECT pg_temp.assert_true(:'appt_cls'::boolean, 'service role stores appointment categories');

-- 12. Homepage aggregate: anon can read counts only, not comments
SET LOCAL ROLE anon;
SELECT count(*) AS anon_rows, COALESCE(max(review_count),0) AS anon_cnt FROM public.public_doctor_ratings() WHERE doctor_user_id = :'doc1' \gset
RESET ROLE;
SELECT pg_temp.assert_true(:'anon_rows'::int = 1 AND :'anon_cnt'::int = 1, 'anon sees aggregate rating for doctor 1');

ROLLBACK;
