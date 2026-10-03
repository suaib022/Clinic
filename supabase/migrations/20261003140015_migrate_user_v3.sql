CREATE OR REPLACE FUNCTION migrate_user_id(old_id UUID, new_id UUID) RETURNS void AS $$
BEGIN
    -- Disable triggers temporally if needed? No, just update foreign keys.
    -- Wait, we can't update public.users.id if it's referenced by other tables without ON UPDATE CASCADE.
    -- So we have to insert a NEW public.users row, update all children, and delete the OLD public.users row!
    
    -- 1. Insert new public.users row
    INSERT INTO public.users (id, full_name, email, role, phone, address, avatar_url, created_at)
    SELECT new_id, full_name, email, role, phone, address, avatar_url, created_at
    FROM public.users WHERE id = old_id;
    
    -- 2. Update children
    UPDATE public.appointments SET patient_id = new_id WHERE patient_id = old_id;
    UPDATE public.appointments SET doctor_id = new_id WHERE doctor_id = old_id;
    
    UPDATE public.medical_records SET patient_id = new_id WHERE patient_id = old_id;
    UPDATE public.medical_records SET doctor_id = new_id WHERE doctor_id = old_id;
    UPDATE public.medical_records SET uploaded_by = new_id WHERE uploaded_by = old_id;
    
    UPDATE public.doctor_specialities SET doctor_id = new_id WHERE doctor_id = old_id;
    UPDATE public.doctor_schedules SET doctor_id = new_id WHERE doctor_id = old_id;
    UPDATE public.doctor_leave_requests SET doctor_id = new_id WHERE doctor_id = old_id;
    
    UPDATE public.compounders SET assigned_doctor_id = new_id WHERE assigned_doctor_id = old_id;
    UPDATE public.compounders SET id = new_id WHERE id = old_id; -- wait, compounders.id is PK! we must insert and delete
    
    -- For compounders:
    IF EXISTS (SELECT 1 FROM public.compounders WHERE id = old_id) THEN
        INSERT INTO public.compounders (id, assigned_doctor_id, shift_start, shift_end, is_active)
        SELECT new_id, assigned_doctor_id, shift_start, shift_end, is_active FROM public.compounders WHERE id = old_id;
        DELETE FROM public.compounders WHERE id = old_id;
    END IF;

    -- For admins:
    IF EXISTS (SELECT 1 FROM public.admins WHERE id = old_id) THEN
        INSERT INTO public.admins (id, permissions, is_super_admin)
        SELECT new_id, permissions, is_super_admin FROM public.admins WHERE id = old_id;
        DELETE FROM public.admins WHERE id = old_id;
    END IF;
    
    -- For doctors (legacy and new):
    IF EXISTS (SELECT 1 FROM public.doctors WHERE id = old_id) THEN
        -- doctors table
        INSERT INTO public.doctors (id, doctor_id, pin_hash, consultation_fee, avatar_url)
        SELECT new_id, doctor_id, pin_hash, consultation_fee, avatar_url FROM public.doctors WHERE id = old_id;
        DELETE FROM public.doctors WHERE id = old_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.legacy_doctors WHERE user_id = old_id) THEN
        UPDATE public.legacy_doctors SET user_id = new_id WHERE user_id = old_id;
    END IF;

    -- 3. Delete old public.users row
    DELETE FROM public.users WHERE id = old_id;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
