
-- 1. Create specialities table
CREATE TABLE IF NOT EXISTS public.specialities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

-- 2. Create doctor_specialities
CREATE TABLE IF NOT EXISTS public.doctor_specialities (
    doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    speciality_id UUID REFERENCES public.specialities(id) ON DELETE CASCADE,
    PRIMARY KEY (doctor_id, speciality_id)
);

-- 3. Create doctor_schedules
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(doctor_id, day_of_week)
);

-- 4. Create doctor_schedule_breaks
CREATE TABLE IF NOT EXISTS public.doctor_schedule_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- 5. Create doctor_leave_requests
CREATE TABLE IF NOT EXISTS public.doctor_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('full_day', 'partial_day')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(doctor_id, appointment_date, start_time)
);

-- RLS Policies
ALTER TABLE public.specialities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read specialities" ON public.specialities;
CREATE POLICY "Allow public read specialities" ON public.specialities FOR SELECT USING (true);

ALTER TABLE public.doctor_specialities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read doctor_specialities" ON public.doctor_specialities;
CREATE POLICY "Allow public read doctor_specialities" ON public.doctor_specialities FOR SELECT USING (true);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read doctor_schedules" ON public.doctor_schedules;
CREATE POLICY "Allow public read doctor_schedules" ON public.doctor_schedules FOR SELECT USING (true);

ALTER TABLE public.doctor_schedule_breaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read doctor_schedule_breaks" ON public.doctor_schedule_breaks;
CREATE POLICY "Allow public read doctor_schedule_breaks" ON public.doctor_schedule_breaks FOR SELECT USING (true);

ALTER TABLE public.doctor_leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read doctor_leave_requests" ON public.doctor_leave_requests;
CREATE POLICY "Allow public read doctor_leave_requests" ON public.doctor_leave_requests FOR SELECT USING (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read appointments" ON public.appointments;
CREATE POLICY "Allow public read appointments" ON public.appointments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user insert appointments" ON public.appointments;
CREATE POLICY "Allow user insert appointments" ON public.appointments FOR INSERT WITH CHECK (true); -- Relaxed for testing

-- Clear existing mappings and messy specialities in case this is a re-run
TRUNCATE TABLE public.specialities CASCADE;


INSERT INTO public.specialities (name) VALUES ('ADMINISTRATION') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('BURN & PLASTIC SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('CARDIAC SURGERY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('CARDIOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('CHEST & THORACIC SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('CHILD CARDIOLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('CHILD NEUROLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('DENTAL SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('DERMATOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('DOCTOR ASSISTANT') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('EMERGENCY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ENDOCRINOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ENDOCRINOLOGY & DIABETOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ENT SPECIALIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('Foetal medicine') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('GASTROENTEROLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('GENERAL & COLORECTUL SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('GENERAL & LAPAROSCOPIC SURGERY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('GENERAL SURGERY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('GYNAE & OBSTETRICS') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('HAEMATOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('HEALTH CARE') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('HEPATIC SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('HEPATOLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('INTERNAL MEDICINE') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('IT') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('LAPAROSCOPIC COLORECTAL SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('MARKETING') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('MEDICINE') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('MEDICINE & PULMONOLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('MEDICINE & RHEUMATOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('MEDICINE SPECIALIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('NEPHROLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('NEURO SURGERY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('NEUROLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('NUTRITIONIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ONCOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('OPTHALMOLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ORTHOPEDIC SURGEON') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('ORTHOPEDICS') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PAEDIATRIC SURGERY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PAEDIATRICS') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PAIN MEDICINE') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('Pediatric Gastroenterology') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PEDIATRICS & NEONATOLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PHYSICAL MEDICINE SPECIALIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('PSYCHIATRY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('RADIOLOGY & IMAGING') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('RHEUMATOLOGIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('THYROID SPECIALIST') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('UROLOGY') ON CONFLICT DO NOTHING;
INSERT INTO public.specialities (name) VALUES ('VASCULAR SURGEON') ON CONFLICT DO NOTHING;

-- Link doctors to specialities
DO $$
DECLARE
    doc_id UUID;
    spec_id UUID;
BEGIN
    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mohammad Sohel-Uzzaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. AKM Mustakim Billah' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Khalid Bin Rahman Apourba' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Asif Yazdani' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Shafiqul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mostak Ahmed' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Arif Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'EMERGENCY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Khondaker Md. Masud' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Nurul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Foara Tasmim' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'BURN & PLASTIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Maruf Alam Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'BURN & PLASTIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Lutfor Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Lokman Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'DR. AMIRUL ISLAM BHUYAN' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Akhter Hamid Parvez' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Shahadot Hossain Sheikh' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'LAPAROSCOPIC COLORECTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Most. Bilkis Fatema' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Muhammad Ali Siddiquee' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof Dr. Amzad Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Nasir Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'BURN & PLASTIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Zakir Ahmed Shaheen' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Safiqur Rahman Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mohammad Shamim al Mamun' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Nirmal Sharma' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Fariha Binte Quayum' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Kazi Rumana Sharmin Rummee' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Sanowar Hossain Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Nargis Salahuddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DENTAL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Mir Nazrul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Quamrul Hassan Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Lt. Col. (Retd.) Dr. Md. Abdul Wahab' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Isabela Kabir' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mahmud Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'DERMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. M Saifuddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Indrajit Prasad' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Khwaja Nazim Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Marufa Mustari' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Feroz Amin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Ruhul Amin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. M. R. Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. SK Nurul Fattah Rumi' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. K. M. Mamun Murshed' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Sabah Uddin Ahmed' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Shafiqul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Mazibur Rahman Meaji' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Mian Mashhud Ahmad' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Bimal Chandra Shil' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Chanchal Kumar Ghosh' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Swapan Chandra Dhar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Ashraful Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Kazi Monisur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Swapan Kumar Sarkar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. M Khademul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Saifullah' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'DR. A. Z. MAHMUDUL HASAN KANAK' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Mamunur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Colonel (Dr) Nasir Uddin (Mahmud) BGBMS' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & COLORECTUL SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'BURN & PLASTIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. A.K.M Ahsan Ullah' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Mariam Faruqui (Shati)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Sehereen F. Siddiqua' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Afzalunnessa Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Begum Hosne Ara' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Tasnim Akter' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Umme Salma Chowdhury (Shanta)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Kaniz Fatema' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'DR. SERAJOOM MUNIRA' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Shikha Ganguly' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Tayeba Sultana' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Sharmin Ferdous (Koly)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Tahmina Akter' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Juthi Bhowmik' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. M A Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Sirajul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HAEMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md Ashikuzzaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HAEMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Akhter Ahmed (Shuvo)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Sarwar Ahmed Sobhan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Salimur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Retd.) Dr. Nooruddin Ahmad' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Faroque Ahmed' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Baren Chakraborty' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mahbubor Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Abduz Zaher' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Nur Mohammad' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Arun Kumar Sharma' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. (Dr.) Md. Abdul Kader Akanda' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Asifudduza (Asif)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. S. Mokaddas Hossain (Sadi)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. S M Mustafa Zaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. (Dr.) M M Zahurul Alam Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. A.K.S Zahid Mahmud Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. (Dr.) M G Azam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Nur Alam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Brig. General Dr. Md. Wali-Ur-Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. (Dr.) Razia Sultana Mahmud' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'DR. LOHANI MD. TAJUL ISLAM' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mohammad Abul Khayer' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Rashiduz Zaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mohammad Ziaul Kabir' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Shiblee Sadik Pathan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md Jaglul Kabir' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Mohasin Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. A P M Sohrabuzzaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mustafizur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIAC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Md. Mohsin Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Samiran Kumar Saha' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Md. Monzur Rahman (Galib)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. DR. SANKAR NARAYAN DAS' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Md. Abdul Jalil Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Abed Hussain Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. (Dr.) A.K.M. Musa' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Kamrul Hasan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'HEPATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Rubina Yasmin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Shah Habibur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & RHEUMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Abu Shahin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & RHEUMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Muhammad Rafiqul Alam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Mohammad Moniruzzaman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. A.S.M. Julfekar Helal' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Asia Khanam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Sumon Chandra Roy' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Abu Zafor Md. Salahuddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Shah Newaz Dewan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Moududul Haque' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEURO SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. S.I.M. Khairun Nabi Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Haradhan Deb Nath' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Rezaul Amin (Titu)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEURO SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. M. M. Ehsanul Haque' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEURO SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. B Karim' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEURO SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Sirajul Haque' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Ashraf Ali' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Md. Azharul Hoque' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (dr.) M. A. Hannan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'INTERNAL MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Mansur Habib' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Shahida Bulbul' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Kazi Jannat Ara' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. A.F.M. Kamal Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Moarraf Hossen' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Associate Professor. Dr. Shamsun Nahar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Ansarul Huq' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. (Dr.) G. M. Mostafa' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'OPTHALMOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. M. Amjad Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Abu Zaffar Chowdhury (Biru)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Zia Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Erfanul Huq Siddiqui' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Sheikh Forhad' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Quazi Shahid-Ul-Alam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Chandra Shekhar Karmakar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAIN MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Abdul Mannan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Habibur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Syed Khairul Amin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Ajmery Sultana Chowdhury' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Shariful Hasan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NUTRITIONIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'Pediatric Gastroenterology' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GASTROENTEROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Brig. Gen. Professor Nurunnahar Fatema S.B.P' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Syed Saimul Huque' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Associate Prof. Dr. Naznin Akter (Ruby)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Mirza Kamrul Zahid' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Syed Mozaffar Ahmed' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PHYSICAL MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & RHEUMATOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAIN MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. A K M Salek' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PHYSICAL MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Tariqul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PHYSICAL MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ORTHOPEDICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAIN MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'RHEUMATOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof.Dr. M A Mohit Kamal' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PSYCHIATRY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Md. Faruq Alam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PSYCHIATRY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PAEDIATRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Saifun Nahar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'PSYCHIATRY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Chaya Bhattacharjee' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. (Dr.) F. M. Siddiqui' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Ali Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Md. Sayedul Islam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Zakir Hossain Sarkar' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. AKM Mosharraf Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Mohammed Atiqur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE & PULMONOLOGIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Kazi Mohibur Rahman' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor (Dr.) Md. Shahidullah (Sabuj)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Subash Kanti Dey' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEUROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Mosharraf Hossain (Shamim)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Shamsul Alam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CHEST & THORACIC SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Sayedur Rahman Miah' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENDOCRINOLOGY & DIABETOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'CARDIOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. DR. MD. SANOWAR HOSSAIN' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor. Dr. Md. Jahangir Kabir' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Mohammad Abdus Salam' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. A Z M Zahid Hossain' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Professor Dr. Tohid Md. Saiful Hossain (Dipu)' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL & LAPAROSCOPIC SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Maj Gen Professor Dr. H R Harun' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Prof. Dr. Md. Shaukat Ali Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GYNAE & OBSTETRICS' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Nasir Uddin' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'UROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'NEPHROLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ONCOLOGY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Md. Bazlul Ghani Bhuiyan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. HM Ashfaq Nazmi' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    SELECT id INTO doc_id FROM public.users WHERE full_name = 'Dr. Nagib Mahfuz Khan' AND role = 'doctor' LIMIT 1;
    IF doc_id IS NOT NULL THEN
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'MEDICINE' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'GENERAL SURGERY' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'ENT SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'IT' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'VASCULAR SURGEON' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
        SELECT id INTO spec_id FROM public.specialities WHERE name = 'THYROID SPECIALIST' LIMIT 1;
        IF spec_id IS NOT NULL THEN
            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;
        END IF;
    END IF;


    -- Seed Default Schedules
    FOR doc_id IN SELECT id FROM public.users WHERE role = 'doctor'
    LOOP
        FOR day IN 0..6 LOOP
            IF day != 5 THEN -- 5 is Friday (off)
                INSERT INTO public.doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
                VALUES (doc_id, day, '09:00:00', '20:00:00', 10)
                ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

                -- Insert default breaks
                -- 1:00 PM to 2:30 PM (13:00 to 14:30)
                INSERT INTO public.doctor_schedule_breaks (doctor_id, day_of_week, start_time, end_time)
                VALUES (doc_id, day, '13:00:00', '14:30:00');
                
                -- 4:40 PM to 5:20 PM (16:40 to 17:20)
                INSERT INTO public.doctor_schedule_breaks (doctor_id, day_of_week, start_time, end_time)
                VALUES (doc_id, day, '16:40:00', '17:20:00');

                -- 6:40 PM to 7:20 PM (18:40 to 19:20)
                INSERT INTO public.doctor_schedule_breaks (doctor_id, day_of_week, start_time, end_time)
                VALUES (doc_id, day, '18:40:00', '19:20:00');
            END IF;
        END LOOP;
    END LOOP;
END $$;
