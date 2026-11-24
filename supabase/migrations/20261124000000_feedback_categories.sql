-- Feedback categories + voice flag on doctor-visit feedback.
-- Extends appointment_feedbacks; keeps existing rows and RLS untouched.

ALTER TABLE public.appointment_feedbacks
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS input_method text NOT NULL DEFAULT 'typed',
  ADD COLUMN IF NOT EXISTS classified_at timestamptz;

ALTER TABLE public.appointment_feedbacks DROP CONSTRAINT IF EXISTS appointment_feedbacks_categories_check;
ALTER TABLE public.appointment_feedbacks ADD CONSTRAINT appointment_feedbacks_categories_check
  CHECK (categories <@ ARRAY['positive', 'negative', 'improvement', 'staff']::text[]);
ALTER TABLE public.appointment_feedbacks DROP CONSTRAINT IF EXISTS appointment_feedbacks_sentiment_check;
ALTER TABLE public.appointment_feedbacks ADD CONSTRAINT appointment_feedbacks_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative'));
ALTER TABLE public.appointment_feedbacks DROP CONSTRAINT IF EXISTS appointment_feedbacks_input_method_check;
ALTER TABLE public.appointment_feedbacks ADD CONSTRAINT appointment_feedbacks_input_method_check
  CHECK (input_method IN ('typed', 'voice'));

-- Replace the RPC: new optional last param p_input_method. Drop the old 5-arg signature first
-- so no overload ambiguity remains.
DROP FUNCTION IF EXISTS public.submit_appointment_feedback(UUID, INTEGER, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.submit_appointment_feedback(
    p_appointment_id UUID,
    p_doctor_rating INTEGER,
    p_service_rating INTEGER,
    p_comment TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_input_method TEXT DEFAULT 'typed'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_appt public.appointments;
    v_feedback_id UUID;
    v_user_role TEXT;
    v_caller_uid UUID;
    v_days_elapsed INTEGER;
BEGIN
    v_caller_uid := auth.uid();
    IF current_setting('role', true) = 'service_role' THEN
        v_user_role := 'admin';
    ELSE
        v_user_role := public.get_user_role();
    END IF;

    SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    IF v_user_role != 'admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.patients
            WHERE id = v_appt.patient_id AND auth_user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Permission denied: This appointment does not belong to your account.';
        END IF;
    END IF;

    IF v_appt.status != 'completed' THEN
        RAISE EXCEPTION 'Feedback can only be submitted for completed visits (current status: %).', v_appt.status;
    END IF;

    v_days_elapsed := (CURRENT_DATE - v_appt.appointment_date);
    IF v_days_elapsed > 7 THEN
        RAISE EXCEPTION 'Feedback window expired. Feedback can only be submitted within 7 days of the visit (visit was % days ago).', v_days_elapsed;
    END IF;

    IF p_doctor_rating < 1 OR p_doctor_rating > 5 THEN
        RAISE EXCEPTION 'Doctor rating must be between 1 and 5 stars';
    END IF;

    IF p_service_rating < 1 OR p_service_rating > 5 THEN
        RAISE EXCEPTION 'Service quality rating must be between 1 and 5 stars';
    END IF;

    IF p_input_method NOT IN ('typed', 'voice') THEN
        RAISE EXCEPTION 'Input method must be typed or voice';
    END IF;

    IF EXISTS (SELECT 1 FROM public.appointment_feedbacks WHERE appointment_id = p_appointment_id) THEN
        RAISE EXCEPTION 'Feedback has already been submitted for this visit.';
    END IF;

    INSERT INTO public.appointment_feedbacks (
        appointment_id,
        patient_id,
        doctor_id,
        doctor_rating,
        service_rating,
        comment,
        visit_date,
        metadata,
        input_method
    ) VALUES (
        p_appointment_id,
        v_appt.patient_id,
        v_appt.doctor_id,
        p_doctor_rating,
        p_service_rating,
        NULLIF(TRIM(p_comment), ''),
        v_appt.appointment_date,
        COALESCE(p_metadata, '{}'::jsonb),
        p_input_method
    )
    RETURNING id INTO v_feedback_id;

    RETURN v_feedback_id;
END;
$function$;

-- Server-only writer for classifier output (called with the service role key after submit).
CREATE OR REPLACE FUNCTION public.set_feedback_classification(
    p_kind TEXT,
    p_id UUID,
    p_categories TEXT[],
    p_sentiment TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF p_kind = 'appointment' THEN
        UPDATE public.appointment_feedbacks
           SET categories = COALESCE(p_categories, '{}'), sentiment = p_sentiment, classified_at = now()
         WHERE id = p_id;
    ELSIF p_kind = 'lab' THEN
        UPDATE public.lab_feedbacks
           SET categories = COALESCE(p_categories, '{}'), sentiment = p_sentiment, classified_at = now()
         WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Unknown feedback kind: %', p_kind;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_feedback_classification(TEXT, UUID, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_feedback_classification(TEXT, UUID, TEXT[], TEXT) TO service_role;

-- Public, aggregate-only doctor ratings for the homepage. No comments, no patient data.
CREATE OR REPLACE FUNCTION public.public_doctor_ratings()
RETURNS TABLE (doctor_user_id uuid, avg_rating numeric, review_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.doctor_id,
         ROUND(AVG((f.doctor_rating + f.service_rating) / 2.0), 1),
         COUNT(*)::integer
    FROM public.appointment_feedbacks f
   GROUP BY f.doctor_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_doctor_ratings() TO anon, authenticated;
