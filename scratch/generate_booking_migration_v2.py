import json
import re

ALLOWED_SPECIALITIES = [
    "ADMINISTRATION", "BURN & PLASTIC SURGEON", "CARDIAC SURGERY", "CARDIOLOGY",
    "CHEST & THORACIC SURGEON", "CHILD CARDIOLOGIST", "CHILD NEUROLOGIST", "DENTAL SURGEON",
    "DERMATOLOGY", "DOCTOR ASSISTANT", "EMERGENCY", "ENDOCRINOLOGY", "ENDOCRINOLOGY & DIABETOLOGY",
    "ENT SPECIALIST", "Foetal medicine", "GASTROENTEROLOGY", "GENERAL & COLORECTUL SURGEON",
    "GENERAL & LAPAROSCOPIC SURGERY", "GENERAL SURGERY", "GYNAE & OBSTETRICS", "HAEMATOLOGY",
    "HEALTH CARE", "HEPATIC SURGEON", "HEPATOLOGIST", "INTERNAL MEDICINE", "IT",
    "LAPAROSCOPIC COLORECTAL SURGEON", "MARKETING", "MEDICINE", "MEDICINE & PULMONOLOGIST",
    "MEDICINE & RHEUMATOLOGY", "MEDICINE SPECIALIST", "NEPHROLOGY", "NEURO SURGERY",
    "NEUROLOGY", "NUTRITIONIST", "ONCOLOGY", "OPTHALMOLOGY", "ORTHOPEDIC SURGEON",
    "ORTHOPEDICS", "PAEDIATRIC SURGERY", "PAEDIATRICS", "PAIN MEDICINE", "Pediatric Gastroenterology",
    "PEDIATRICS & NEONATOLOGIST", "PHYSICAL MEDICINE SPECIALIST", "PSYCHIATRY",
    "RADIOLOGY & IMAGING", "RHEUMATOLOGIST", "THYROID SPECIALIST", "UROLOGY", "VASCULAR SURGEON"
]

def get_mapped_specialities(doc, dept_name):
    text_to_search = f"{doc.get('speciality', '')} {doc.get('designation', '')} {dept_name}".lower()
    found = set()
    
    # Keyword mapping overrides for better matching
    keyword_map = {
        'cardiac': ['CARDIOLOGY', 'CARDIAC SURGERY'],
        'heart': ['CARDIOLOGY'],
        'skin': ['DERMATOLOGY'],
        'child': ['PAEDIATRICS'],
        'pediatric': ['PAEDIATRICS'],
        'paediatric': ['PAEDIATRICS'],
        'eye': ['OPTHALMOLOGY'],
        'bone': ['ORTHOPEDICS'],
        'ortho': ['ORTHOPEDICS'],
        'neuro': ['NEUROLOGY'],
        'brain': ['NEURO SURGERY', 'NEUROLOGY'],
        'kidney': ['NEPHROLOGY'],
        'liver': ['HEPATOLOGIST'],
        'gastro': ['GASTROENTEROLOGY'],
        'stomach': ['GASTROENTEROLOGY'],
        'cancer': ['ONCOLOGY'],
        'tumor': ['ONCOLOGY'],
        'ent': ['ENT SPECIALIST'],
        'ear': ['ENT SPECIALIST'],
        'nose': ['ENT SPECIALIST'],
        'throat': ['ENT SPECIALIST'],
        'gynae': ['GYNAE & OBSTETRICS'],
        'obs': ['GYNAE & OBSTETRICS'],
        'women': ['GYNAE & OBSTETRICS'],
        'diabetes': ['ENDOCRINOLOGY & DIABETOLOGY'],
        'diabet': ['ENDOCRINOLOGY & DIABETOLOGY'],
        'hormone': ['ENDOCRINOLOGY'],
        'thyroid': ['THYROID SPECIALIST'],
        'blood': ['HAEMATOLOGY'],
        'burn': ['BURN & PLASTIC SURGEON'],
        'plastic': ['BURN & PLASTIC SURGEON'],
        'dental': ['DENTAL SURGEON'],
        'tooth': ['DENTAL SURGEON'],
        'teeth': ['DENTAL SURGEON'],
        'urology': ['UROLOGY'],
        'vascular': ['VASCULAR SURGEON'],
        'rheuma': ['RHEUMATOLOGIST'],
        'physical medicine': ['PHYSICAL MEDICINE SPECIALIST'],
        'psychiatry': ['PSYCHIATRY'],
        'mental': ['PSYCHIATRY'],
        'nutrition': ['NUTRITIONIST'],
        'diet': ['NUTRITIONIST'],
        'pain': ['PAIN MEDICINE'],
        'laparoscopic': ['GENERAL & LAPAROSCOPIC SURGERY'],
        'colorectal': ['GENERAL & COLORECTUL SURGEON'],
        'chest': ['CHEST & THORACIC SURGEON'],
        'lung': ['MEDICINE & PULMONOLOGIST'],
        'pulmo': ['MEDICINE & PULMONOLOGIST'],
        'admin': ['ADMINISTRATION'],
        'emergency': ['EMERGENCY'],
        'imaging': ['RADIOLOGY & IMAGING'],
        'radiology': ['RADIOLOGY & IMAGING'],
        'medicine': ['MEDICINE SPECIALIST'],
        'surgery': ['GENERAL SURGERY'],
    }
    
    # 1. Exact or partial match with allowed specialities directly
    for allowed in ALLOWED_SPECIALITIES:
        if allowed.lower() in text_to_search:
            found.add(allowed)
            
    # 2. Match via keywords
    for keyword, mapped_specs in keyword_map.items():
        if keyword in text_to_search:
            for ms in mapped_specs:
                found.add(ms)
                
    # Filter down redundant ones (e.g. if CARDIOLOGY and CARDIAC SURGERY, keep both, 
    # but if MEDICINE SPECIALIST and INTERNAL MEDICINE, maybe just keep one. We'll keep all found)
    
    if not found:
        # Fallback based on department
        found.add('MEDICINE')
        
    # Standardize casing to the allowed list exact match
    final_specs = []
    for f in found:
        for allowed in ALLOWED_SPECIALITIES:
            if f.lower() == allowed.lower():
                final_specs.append(allowed)
                break
                
    return list(set(final_specs))

with open('labaid_complete_data.json', 'r') as f:
    data = json.load(f)

doctor_specialities_map = {}
for dept in data:
    dept_name = dept.get('department_name', '')
    for doc in dept.get('doctors', []):
        doc_name = doc['name']
        doctor_specialities_map[doc_name] = get_mapped_specialities(doc, dept_name)

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


"""

# Insert allowed specialities
for spec in ALLOWED_SPECIALITIES:
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

print("Migration script updated successfully with allowed specialities.")
