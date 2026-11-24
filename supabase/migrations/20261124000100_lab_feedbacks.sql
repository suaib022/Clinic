-- Lab test feedback: one row per lab order, written only through submit_lab_feedback.

CREATE TABLE IF NOT EXISTS public.lab_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL UNIQUE REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_rating integer NOT NULL CHECK (test_rating BETWEEN 1 AND 5),
  service_rating integer NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
  comment text,
  categories text[] NOT NULL DEFAULT '{}' CHECK (categories <@ ARRAY['positive', 'negative', 'improvement', 'staff']::text[]),
  sentiment text CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  input_method text NOT NULL DEFAULT 'typed' CHECK (input_method IN ('typed', 'voice')),
  classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_feedbacks_patient ON public.lab_feedbacks (patient_id);

ALTER TABLE public.lab_feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_feedbacks_read ON public.lab_feedbacks;
CREATE POLICY lab_feedbacks_read ON public.lab_feedbacks FOR SELECT TO authenticated USING (
  public.get_user_role()::text IN ('admin', 'technician')
  OR patient_id IN (SELECT p.id FROM public.patients p WHERE p.auth_user_id = auth.uid())
);

REVOKE ALL ON public.lab_feedbacks FROM anon, authenticated;
GRANT SELECT ON public.lab_feedbacks TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_lab_feedback(
  p_lab_order_id uuid,
  p_test_rating integer,
  p_service_rating integer,
  p_comment text DEFAULT NULL,
  p_input_method text DEFAULT 'typed'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.lab_orders;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;

  SELECT * INTO v_order FROM public.lab_orders WHERE id = p_lab_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lab order not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = v_order.patient_id AND p.auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: This test does not belong to your account.';
  END IF;

  IF v_order.status <> 'report_ready' THEN
    RAISE EXCEPTION 'Feedback can only be submitted after the report is ready (current status: %).', v_order.status;
  END IF;

  IF v_order.report_ready_at IS NULL OR now() > v_order.report_ready_at + interval '7 days' THEN
    RAISE EXCEPTION 'Feedback window expired. Feedback can only be submitted within 7 days of the report.';
  END IF;

  IF p_test_rating IS NULL OR p_test_rating < 1 OR p_test_rating > 5 THEN
    RAISE EXCEPTION 'Test rating must be between 1 and 5 stars';
  END IF;

  IF p_service_rating IS NULL OR p_service_rating < 1 OR p_service_rating > 5 THEN
    RAISE EXCEPTION 'Service quality rating must be between 1 and 5 stars';
  END IF;

  IF p_input_method NOT IN ('typed', 'voice') THEN
    RAISE EXCEPTION 'Input method must be typed or voice';
  END IF;

  IF EXISTS (SELECT 1 FROM public.lab_feedbacks WHERE lab_order_id = p_lab_order_id) THEN
    RAISE EXCEPTION 'Feedback has already been submitted for this test.';
  END IF;

  INSERT INTO public.lab_feedbacks (lab_order_id, patient_id, test_rating, service_rating, comment, input_method)
  VALUES (p_lab_order_id, v_order.patient_id, p_test_rating, p_service_rating, NULLIF(TRIM(p_comment), ''), p_input_method)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_lab_feedback(uuid, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_lab_feedback(uuid, integer, integer, text, text) TO authenticated;
