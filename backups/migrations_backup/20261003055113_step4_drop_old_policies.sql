DROP POLICY IF EXISTS "Allow public read patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public insert patients" ON public.patients;
DROP POLICY IF EXISTS "Allow public update patients" ON public.patients;

DROP POLICY IF EXISTS "Allow public read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow user insert appointments" ON public.appointments;

DROP POLICY IF EXISTS "Doctors can view their patients records" ON public.medical_records;
DROP POLICY IF EXISTS "Doctors can insert records" ON public.medical_records;
DROP POLICY IF EXISTS "Compounders can view assigned doctor patient records" ON public.medical_records;
DROP POLICY IF EXISTS "Compounders can insert records" ON public.medical_records;
DROP POLICY IF EXISTS "Admins full access on records" ON public.medical_records;
DROP POLICY IF EXISTS "Doctors can upload files" ON public.medical_records;
DROP POLICY IF EXISTS "Doctors can read files" ON public.medical_records;
