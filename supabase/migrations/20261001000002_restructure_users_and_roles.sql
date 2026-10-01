-- Migration: 20261001000002_restructure_users_and_roles.sql
-- Goal: Unified users and roles, doctor unique ID and PIN

-- 1. Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add role to users table (default to doctor since all current users are doctors)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'doctor' CHECK (role IN ('admin', 'doctor', 'compounder', 'patient'));

-- Set existing users to doctor
UPDATE public.users SET role = 'doctor' WHERE role IS NULL;

-- Check for legacy doctors table and rename if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='doctors' AND column_name='id' AND data_type='bigint'
  ) THEN
    ALTER TABLE public.doctors RENAME TO legacy_doctors;
  END IF;
END $$;

-- 3. Create Doctors Profile Table
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    consultation_fee NUMERIC(10,2) DEFAULT 0,
    avatar_url TEXT
);

-- Backfill doctors table with existing users
DO $$
DECLARE
    r RECORD;
    new_doc_id TEXT;
    raw_pin TEXT;
    hashed_pin TEXT;
BEGIN
    FOR r IN SELECT id FROM public.users WHERE role = 'doctor' LOOP
        IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE id = r.id) THEN
            new_doc_id := 'DOC-' || lpad(floor(random() * 1000000)::text, 6, '0');
            raw_pin := floor(random() * 900000 + 100000)::text; -- 6 digit pin
            hashed_pin := crypt(raw_pin, gen_salt('bf'));
            
            INSERT INTO public.doctors (id, doctor_id, pin_hash) 
            VALUES (r.id, new_doc_id, hashed_pin);
            
            -- In a real scenario, we'd log this raw_pin to a secure temporary table or output it
            -- For this exercise, the admin can use the reset PIN function later to set known PINs.
            RAISE NOTICE 'Doctor % created with Doc ID % and PIN %', r.id, new_doc_id, raw_pin;
        END IF;
    END LOOP;
END $$;

-- 4. Create Compounders Profile Table
CREATE TABLE IF NOT EXISTS public.compounders (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    pin_hash TEXT -- Compounders might also need pins if they login without auth
);

-- Note: Patients profile table already exists from the previous migration.
-- However, if patients need to login via Supabase auth, they could be added to users.
-- For now, the prompt implies keeping patient login separate (via patients table with mobile/email + pin).

-- 5. RLS Policies for Doctors and Compounders
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compounders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read doctors" ON public.doctors;
CREATE POLICY "Public read doctors" ON public.doctors FOR SELECT USING (true);

-- Admin can manage everything (assuming we can identify admin via role in users)
-- Since we are querying from the same DB, we can write a function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. Rollback (Commented out for safety)
/*
DROP TABLE IF EXISTS public.compounders CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
*/
