-- Migration: Hospital health analytics (Phase 5)
-- Aggregate-only views over extracted data. No patient_id, name or other identifier is exposed:
-- every row is a group with counts. security_invoker = true keeps the base tables' RLS in force,
-- so only admins see hospital-wide numbers. Small groups are hidden in the app (k-anonymity threshold).

-- Diagnoses (a note may list several, separated by ';')
CREATE OR REPLACE VIEW public.analytics_diagnoses WITH (security_invoker = true) AS
SELECT
    lower(trim(d)) AS diagnosis,
    count(*) AS mentions,
    count(DISTINCT n.patient_id) AS patients,
    max(n.noted_on) AS last_seen
FROM public.clinical_notes n
CROSS JOIN LATERAL regexp_split_to_table(n.content, '\s*;\s*') AS d
WHERE n.note_type = 'diagnosis' AND trim(d) <> ''
GROUP BY 1;

CREATE OR REPLACE VIEW public.analytics_allergies WITH (security_invoker = true) AS
SELECT
    lower(trim(a)) AS allergy,
    count(DISTINCT n.patient_id) AS patients
FROM public.clinical_notes n
CROSS JOIN LATERAL regexp_split_to_table(n.content, '\s*[;,]\s*') AS a
WHERE n.note_type = 'allergy' AND trim(a) <> ''
GROUP BY 1;

CREATE OR REPLACE VIEW public.analytics_medications WITH (security_invoker = true) AS
SELECT
    lower(trim(drug_name)) AS medicine,
    count(DISTINCT record_id) AS prescriptions,
    count(DISTINCT patient_id) AS patients,
    max(prescribed_on) AS last_prescribed
FROM public.rx_medications
GROUP BY 1;

CREATE OR REPLACE VIEW public.analytics_lab_tests WITH (security_invoker = true) AS
SELECT
    lower(trim(analyte)) AS analyte,
    mode() WITHIN GROUP (ORDER BY unit) AS unit,
    count(*) AS readings,
    count(*) FILTER (WHERE flag IN ('low', 'high', 'critical', 'abnormal')) AS abnormal_readings,
    count(*) FILTER (WHERE flag = 'high' OR flag = 'critical') AS high_readings,
    count(*) FILTER (WHERE flag = 'low') AS low_readings,
    count(DISTINCT patient_id) AS patients,
    round(avg(value_num)::numeric, 2) AS avg_value
FROM public.lab_results
GROUP BY 1;

CREATE OR REPLACE VIEW public.analytics_extraction_status WITH (security_invoker = true) AS
SELECT record_type, extraction_status, count(*) AS documents
FROM public.medical_records
WHERE record_type IN ('prescription', 'test_report')
GROUP BY 1, 2;

GRANT SELECT ON public.analytics_diagnoses, public.analytics_allergies, public.analytics_medications,
    public.analytics_lab_tests, public.analytics_extraction_status TO authenticated;
