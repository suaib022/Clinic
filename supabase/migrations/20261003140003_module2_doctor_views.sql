-- Get paginated patients for a doctor with last visit and next appointment
CREATE OR REPLACE FUNCTION public.get_doctor_patients(
    p_doctor_id UUID,
    p_search TEXT DEFAULT '',
    p_limit INT DEFAULT 10,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    patient_id UUID,
    full_name TEXT,
    uhid TEXT,
    mobile_no TEXT,
    last_visit_date DATE,
    next_appointment_date DATE,
    total_visits BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH doc_patients AS (
        SELECT DISTINCT a.patient_id
        FROM public.appointments a
        WHERE a.doctor_id = p_doctor_id
          AND a.status != 'cancelled'
    ),
    filtered_patients AS (
        SELECT p.id, p.full_name, p.uhid, p.mobile_no
        FROM public.patients p
        JOIN doc_patients dp ON dp.patient_id = p.id
        WHERE p_search = '' 
           OR p.full_name ILIKE '%' || p_search || '%'
           OR p.uhid ILIKE '%' || p_search || '%'
           OR p.mobile_no ILIKE '%' || p_search || '%'
    )
    SELECT 
        fp.id AS patient_id,
        fp.full_name,
        fp.uhid,
        fp.mobile_no,
        (SELECT MAX(a.appointment_date) FROM public.appointments a WHERE a.patient_id = fp.id AND a.doctor_id = p_doctor_id AND a.status = 'completed') AS last_visit_date,
        (SELECT MIN(a.appointment_date) FROM public.appointments a WHERE a.patient_id = fp.id AND a.doctor_id = p_doctor_id AND a.appointment_date >= CURRENT_DATE AND a.status IN ('scheduled', 'checked_in')) AS next_appointment_date,
        (SELECT COUNT(a.id) FROM public.appointments a WHERE a.patient_id = fp.id AND a.doctor_id = p_doctor_id AND a.status = 'completed') AS total_visits
    FROM filtered_patients fp
    ORDER BY fp.full_name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
