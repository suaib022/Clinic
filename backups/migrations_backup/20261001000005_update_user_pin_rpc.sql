-- Function to securely update a user's PIN
CREATE OR REPLACE FUNCTION public.update_user_pin(p_user_id UUID, p_new_pin TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_hashed_pin TEXT;
BEGIN
    -- Get the user's role
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;

    -- Create hash
    v_hashed_pin := crypt(p_new_pin, gen_salt('bf'));

    -- Update the correct profile table
    IF v_role = 'doctor' THEN
        UPDATE public.doctors SET pin_hash = v_hashed_pin WHERE id = p_user_id;
        RETURN TRUE;
    ELSIF v_role = 'compounder' THEN
        UPDATE public.compounders SET pin_hash = v_hashed_pin WHERE id = p_user_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
