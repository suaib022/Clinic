-- Create patients table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uhid TEXT UNIQUE NOT NULL,
    pin TEXT,
    title TEXT,
    full_name TEXT NOT NULL,
    father_name TEXT,
    gender TEXT,
    dob DATE,
    mobile_no TEXT NOT NULL,
    email TEXT,
    address TEXT,
    country TEXT,
    state TEXT,
    city TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Update appointments table to link to patients instead of users.
-- First, clear existing appointments (test data) to avoid foreign key violations
TRUNCATE TABLE public.appointments CASCADE;

-- We must drop the existing foreign key and add a new one.
ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Update the status check constraint to include 'hold'
ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('hold', 'scheduled', 'completed', 'cancelled'));

-- Update default status to 'hold'
ALTER TABLE public.appointments
ALTER COLUMN status SET DEFAULT 'hold';

-- Enable RLS for patients and add policies
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read patients" ON public.patients;
CREATE POLICY "Allow public read patients" ON public.patients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert patients" ON public.patients;
CREATE POLICY "Allow public insert patients" ON public.patients FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update patients" ON public.patients;
CREATE POLICY "Allow public update patients" ON public.patients FOR UPDATE USING (true);
