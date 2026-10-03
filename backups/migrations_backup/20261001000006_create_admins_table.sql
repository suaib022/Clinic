-- Create admins table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    avatar_url TEXT
);

-- Enable Row Level Security (RLS) to prevent unauthorized access
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Auto seed admin@gmail.com / admin123
DO $$ 
DECLARE
    v_admin_id UUID;
BEGIN
    -- Check if admin exists
    SELECT id INTO v_admin_id FROM public.users WHERE email = 'admin@gmail.com';
    
    IF v_admin_id IS NULL THEN
        v_admin_id := gen_random_uuid();
        
        -- Insert into auth.users first to satisfy foreign key constraint
        -- Note: A database trigger will automatically create the row in public.users
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
            'admin@gmail.com', crypt('admin123', gen_salt('bf')), 
            now(), '{"full_name":"System Admin"}', now(), now()
        );
        
        -- Update the automatically created users table record to be an admin
        UPDATE public.users SET role = 'admin', full_name = 'System Admin' WHERE id = v_admin_id;

        -- Insert into admins table with hashed pin
        INSERT INTO public.admins (id, pin_hash)
        VALUES (v_admin_id, crypt('admin123', gen_salt('bf')));
    ELSE
        -- If user exists but not in admins table, add to admins
        IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id = v_admin_id) THEN
            INSERT INTO public.admins (id, pin_hash)
            VALUES (v_admin_id, crypt('admin123', gen_salt('bf')));
        END IF;
    END IF;
END $$;

-- Update verify_user_pin to support admins
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id UUID, p_pin TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_hash TEXT;
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;

    IF v_role = 'doctor' THEN
        SELECT pin_hash INTO v_stored_hash FROM public.doctors WHERE id = p_user_id;
    ELSIF v_role = 'compounder' THEN
        SELECT pin_hash INTO v_stored_hash FROM public.compounders WHERE id = p_user_id;
    ELSIF v_role = 'admin' THEN
        SELECT pin_hash INTO v_stored_hash FROM public.admins WHERE id = p_user_id;
    END IF;

    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_stored_hash = crypt(p_pin, v_stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update update_user_pin to support admins
CREATE OR REPLACE FUNCTION public.update_user_pin(p_user_id UUID, p_new_pin TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_hashed_pin TEXT;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
    v_hashed_pin := crypt(p_new_pin, gen_salt('bf'));

    IF v_role = 'doctor' THEN
        UPDATE public.doctors SET pin_hash = v_hashed_pin WHERE id = p_user_id;
        RETURN TRUE;
    ELSIF v_role = 'compounder' THEN
        UPDATE public.compounders SET pin_hash = v_hashed_pin WHERE id = p_user_id;
        RETURN TRUE;
    ELSIF v_role = 'admin' THEN
        UPDATE public.admins SET pin_hash = v_hashed_pin WHERE id = p_user_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
