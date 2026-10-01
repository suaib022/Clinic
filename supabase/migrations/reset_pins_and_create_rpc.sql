-- Function to securely verify a user's PIN
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id UUID, p_pin TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_hash TEXT;
    v_role TEXT;
BEGIN
    -- Get the user's role
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;

    -- Fetch the hash from the correct profile table
    IF v_role = 'doctor' THEN
        SELECT pin_hash INTO v_stored_hash FROM public.doctors WHERE id = p_user_id;
    ELSIF v_role = 'compounder' THEN
        SELECT pin_hash INTO v_stored_hash FROM public.compounders WHERE id = p_user_id;
    END IF;

    -- If no hash found, return false
    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verify against the hash
    RETURN v_stored_hash = crypt(p_pin, v_stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Script to Reset All Existing Doctor PINs to '123456' for Testing
DO $$ 
DECLARE
    r RECORD;
    hashed_pin TEXT;
BEGIN
    -- Create the bcrypt hash for '123456'
    hashed_pin := crypt('123456', gen_salt('bf'));
    
    -- Update all doctors with this new hash
    FOR r IN SELECT id FROM public.doctors LOOP
        UPDATE public.doctors 
        SET pin_hash = hashed_pin 
        WHERE id = r.id;
    END LOOP;
END $$;
