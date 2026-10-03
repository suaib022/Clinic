-- Phase 3: Admin audited operations
CREATE OR REPLACE FUNCTION public.admin_soft_delete_record(p_record_id UUID, p_reason TEXT)
RETURNS VOID AS $$
DECLARE
    v_role TEXT;
    v_patient_id UUID;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    
    IF v_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can perform this action';
    END IF;

    SELECT patient_id INTO v_patient_id FROM public.medical_records WHERE id = p_record_id;
    
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'Record not found';
    END IF;

    -- Soft delete
    UPDATE public.medical_records 
    SET is_deleted = TRUE 
    WHERE id = p_record_id;

    -- Audit log
    INSERT INTO public.medical_records_access_log (patient_id, accessed_by, role, action)
    VALUES (v_patient_id, auth.uid(), 'admin', 'Admin soft-deleted record: ' || p_record_id::text || ' Reason: ' || p_reason);
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
