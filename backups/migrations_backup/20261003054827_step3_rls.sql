-- Security helper function to get role securely
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Patients Table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own data" ON public.patients;
CREATE POLICY "Patients can view own data" ON public.patients FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid()
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND EXISTS (
      SELECT 1 FROM public.appointments a 
      WHERE a.patient_id = patients.id 
      AND a.doctor_id = auth.uid() 
      AND a.status != 'cancelled'
  ))
);

DROP POLICY IF EXISTS "Patients can update own data" ON public.patients;
CREATE POLICY "Patients can update own data" ON public.patients FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid());

-- 2. Appointments Table
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appointments view access" ON public.appointments;
CREATE POLICY "Appointments view access" ON public.appointments FOR SELECT TO authenticated
USING (
  patient_id IN (SELECT id FROM public.patients WHERE auth_user_id = auth.uid())
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
);

DROP POLICY IF EXISTS "Appointments update access" ON public.appointments;
CREATE POLICY "Appointments update access" ON public.appointments FOR UPDATE TO authenticated
USING (
  patient_id IN (SELECT id FROM public.patients WHERE auth_user_id = auth.uid())
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
);

DROP POLICY IF EXISTS "Appointments insert access" ON public.appointments;
CREATE POLICY "Appointments insert access" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  patient_id IN (SELECT id FROM public.patients WHERE auth_user_id = auth.uid())
  OR (public.get_user_role() IN ('admin', 'compounder'))
);

-- 3. Medical Records Table
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Medical records view access" ON public.medical_records;
CREATE POLICY "Medical records view access" ON public.medical_records FOR SELECT TO authenticated
USING (
  patient_id IN (SELECT id FROM public.patients WHERE auth_user_id = auth.uid())
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND EXISTS (
      SELECT 1 FROM public.appointments a 
      WHERE a.patient_id = medical_records.patient_id 
      AND a.doctor_id = auth.uid() 
      AND a.status != 'cancelled'
  ))
);

DROP POLICY IF EXISTS "Medical records insert access" ON public.medical_records;
CREATE POLICY "Medical records insert access" ON public.medical_records FOR INSERT TO authenticated
WITH CHECK (
  (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND EXISTS (
      SELECT 1 FROM public.appointments a 
      WHERE a.patient_id = medical_records.patient_id 
      AND a.doctor_id = auth.uid() 
      AND a.status != 'cancelled'
  ))
);

-- 4. Compounders Table
ALTER TABLE public.compounders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Compounders view access" ON public.compounders;
CREATE POLICY "Compounders view access" ON public.compounders FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (public.get_user_role() = 'admin')
  OR (public.get_user_role() = 'doctor' AND assigned_doctor_id = auth.uid())
);

-- 5. Doctors Table
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctors are viewable by everyone" ON public.doctors;
CREATE POLICY "Doctors are viewable by everyone" ON public.doctors FOR SELECT USING (true);

-- 6. Users Table
-- Users should be able to see their own profile, and staff should see others as needed.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.users;
CREATE POLICY "Users can view own profile or admins can view all" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (public.get_user_role() IN ('admin', 'compounder'))
  -- Allow doctors to see basic user details of their patients? Actually users table has role and email. 
  -- Usually doctors can just see patients table.
);

-- Allow public to see doctors' user records? Since name is in users table, they might need to read users.
-- Actually, the frontend fetches doctor profiles from users joined with doctors. So we need public SELECT for users where role='doctor'.
DROP POLICY IF EXISTS "Public can view doctor user records" ON public.users;
CREATE POLICY "Public can view doctor user records" ON public.users FOR SELECT
USING (role = 'doctor');

