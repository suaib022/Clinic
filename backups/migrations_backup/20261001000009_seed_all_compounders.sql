-- Migration: Seed compounder for each doctor
DO $$
DECLARE
    r RECORD;
    v_compounder_id UUID;
    v_idx INTEGER := 1;
    v_email TEXT;
BEGIN
    FOR r IN SELECT id, email FROM public.users WHERE role = 'doctor' ORDER BY created_at, id LOOP
        
        v_email := 'com' || v_idx || '@gmail.com';
        
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = v_email) AND NOT EXISTS (SELECT 1 FROM public.compounders WHERE assigned_doctor_id = r.id) THEN
            
            v_compounder_id := gen_random_uuid();
            
            INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at, 
                created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user
            ) VALUES (
                v_compounder_id, '00000000-0000-0000-0000-000000000000', v_email,
                extensions.crypt('123456', extensions.gen_salt('bf')), now(), now(), now(), 
                '{"provider": "email", "providers": ["email"]}'::jsonb, 
                ('{"full_name": "Compounder ' || v_idx || '"}')::jsonb, false
            );
            
            -- Update the generated public.users row with correct role
            UPDATE public.users SET role = 'compounder' WHERE id = v_compounder_id;
            
            -- Insert into public.compounders
            INSERT INTO public.compounders (id, assigned_doctor_id, pin_hash)
            VALUES (v_compounder_id, r.id, extensions.crypt('123456', extensions.gen_salt('bf')));
            
        END IF;
        
        v_idx := v_idx + 1;
    END LOOP;
END $$;
