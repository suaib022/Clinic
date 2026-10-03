-- Add a dummy compounder
DO $$
DECLARE
    v_compounder_id UUID := gen_random_uuid();
    v_doctor_id UUID;
    v_hashed_pin TEXT;
BEGIN
    -- Get the first doctor to assign to
    SELECT id INTO v_doctor_id FROM public.users WHERE role = 'doctor' LIMIT 1;
    
    v_hashed_pin := extensions.crypt('123456', extensions.gen_salt('bf'));

    -- Check if compounder already exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'compounder@gmail.com') THEN
        
        -- Insert into auth.users which triggers public.users insert
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user
        ) VALUES (
            v_compounder_id, '00000000-0000-0000-0000-000000000000', 'compounder@gmail.com',
            extensions.crypt('123456', extensions.gen_salt('bf')), now(), now(), now(), 
            '{"provider": "email", "providers": ["email"]}', '{"full_name": "Test Compounder"}', false
        );
        
        -- Update the generated public.users row with correct role
        UPDATE public.users SET role = 'compounder' WHERE id = v_compounder_id;
        
        INSERT INTO public.compounders (id, assigned_doctor_id, pin_hash)
        VALUES (v_compounder_id, v_doctor_id, v_hashed_pin);
        
    END IF;
END $$;
