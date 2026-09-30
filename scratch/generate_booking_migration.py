import json
import re

with open('labaid_complete_data.json', 'r') as f:
    data = json.load(f)

# Collect specialities and map them to doctors
# Note: we need to match doctors by name since they are in public.users by full_name
doctor_specialities_map = {}
specialities_set = set()

for dept in data:
    for doc in dept.get('doctors', []):
        doc_name = doc['name']
        spec_str = doc.get('speciality', '')
        doctor_specialities_map[doc_name] = set()
        
        if spec_str:
            parts = re.split(r'\||,', spec_str)
            for p in parts:
                p = ' '.join(p.split())
                if len(p) > 2:
                    specialities_set.add(p)
                    doctor_specialities_map[doc_name].add(p)

migration_sql = """
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

-- RLS Policies (Basic setup to allow authenticated users to read/write as appropriate)
-- Note: In a real app, these would be more locked down.
ALTER TABLE public.specialities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read specialities" ON public.specialities FOR SELECT USING (true);
CREATE POLICY "Allow admin write specialities" ON public.specialities FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

ALTER TABLE public.doctor_specialities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read doctor_specialities" ON public.doctor_specialities FOR SELECT USING (true);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read doctor_schedules" ON public.doctor_schedules FOR SELECT USING (true);

ALTER TABLE public.doctor_schedule_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read doctor_schedule_breaks" ON public.doctor_schedule_breaks FOR SELECT USING (true);

ALTER TABLE public.doctor_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read doctor_leave_requests" ON public.doctor_leave_requests FOR SELECT USING (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Allow user insert appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed Data

"""

# Insert specialities
for spec in specialities_set:
    spec_escaped = spec.replace("'", "''")
    migration_sql += f"INSERT INTO public.specialities (name) VALUES ('{spec_escaped}') ON CONFLICT DO NOTHING;\n"

migration_sql += "\n-- Link doctors to specialities\n"
migration_sql += "DO $$\nDECLARE\n    doc_id UUID;\n    spec_id UUID;\nBEGIN\n"

for doc_name, specs in doctor_specialities_map.items():
    if not specs:
        continue
    doc_escaped = doc_name.replace("'", "''")
    migration_sql += f"    SELECT id INTO doc_id FROM public.users WHERE full_name = '{doc_escaped}' AND role = 'doctor' LIMIT 1;\n"
    migration_sql += "    IF doc_id IS NOT NULL THEN\n"
    for spec in specs:
        spec_escaped = spec.replace("'", "''")
        migration_sql += f"        SELECT id INTO spec_id FROM public.specialities WHERE name = '{spec_escaped}' LIMIT 1;\n"
        migration_sql += "        IF spec_id IS NOT NULL THEN\n"
        migration_sql += "            INSERT INTO public.doctor_specialities (doctor_id, speciality_id) VALUES (doc_id, spec_id) ON CONFLICT DO NOTHING;\n"
        migration_sql += "        END IF;\n"
    migration_sql += "    END IF;\n\n"

migration_sql += """
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
"""

with open('supabase/migrations/20261001000000_create_booking_schema.sql', 'w') as f:
    f.write(migration_sql)

print("Migration script created successfully.")
