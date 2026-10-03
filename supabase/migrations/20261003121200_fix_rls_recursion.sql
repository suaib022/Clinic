-- Create security definer functions to bypass RLS and prevent infinite recursion

CREATE OR REPLACE FUNCTION public.is_patient_owner(p_patient_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients WHERE id = p_patient_id AND auth_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_doctor_of_patient(p_patient_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE patient_id = p_patient_id 
    AND doctor_id = auth.uid() 
    AND status != 'cancelled'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Update Patients Policy
DROP POLICY IF EXISTS "Patients can view own data" ON public.patients;
CREATE POLICY "Patients can view own data" ON public.patients FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid()
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND public.is_doctor_of_patient(id))
);

-- Update Appointments Policy
DROP POLICY IF EXISTS "Appointments view access" ON public.appointments;
CREATE POLICY "Appointments view access" ON public.appointments FOR SELECT TO authenticated
USING (
  public.is_patient_owner(patient_id)
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
);

DROP POLICY IF EXISTS "Appointments update access" ON public.appointments;
CREATE POLICY "Appointments update access" ON public.appointments FOR UPDATE TO authenticated
USING (
  public.is_patient_owner(patient_id)
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
);

DROP POLICY IF EXISTS "Appointments insert access" ON public.appointments;
CREATE POLICY "Appointments insert access" ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  public.is_patient_owner(patient_id)
  OR (public.get_user_role() IN ('admin', 'compounder'))
);

-- Update Medical Records Policy
DROP POLICY IF EXISTS "Medical records view access" ON public.medical_records;
CREATE POLICY "Medical records view access" ON public.medical_records FOR SELECT TO authenticated
USING (
  public.is_patient_owner(patient_id)
  OR (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND public.is_doctor_of_patient(patient_id))
);

DROP POLICY IF EXISTS "Medical records insert access" ON public.medical_records;
CREATE POLICY "Medical records insert access" ON public.medical_records FOR INSERT TO authenticated
WITH CHECK (
  (public.get_user_role() IN ('admin', 'compounder'))
  OR (public.get_user_role() = 'doctor' AND public.is_doctor_of_patient(patient_id))
);
