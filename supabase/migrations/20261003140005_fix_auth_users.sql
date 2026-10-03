-- 1. Identify the recent duplicate auth users and delete them
-- The duplicate auth users were created on 2026-10-03 (or whatever today is)
-- Deleting them will cascade and delete the duplicate public.users
DELETE FROM auth.users 
WHERE created_at > '2026-10-02' 
  AND email LIKE '%@staff.clinic.local';

-- 2. Update the ORIGINAL auth.users emails and passwords
-- For doctors:
UPDATE auth.users au
SET email = 'doc-' || substring(d.doctor_id, 5) || '@staff.clinic.local',
    encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf'))
FROM public.doctors d
WHERE au.id = d.id;

-- For compounders:
UPDATE auth.users au
SET email = 'compounder_' || d.doctor_id || '@staff.clinic.local',
    encrypted_password = extensions.crypt('123456', extensions.gen_salt('bf'))
FROM public.compounders c
JOIN public.doctors d ON d.id = c.assigned_doctor_id
WHERE au.id = c.id;

-- 3. Update public.users emails to match
UPDATE public.users pu
SET email = 'doc-' || substring(d.doctor_id, 5) || '@staff.clinic.local'
FROM public.doctors d
WHERE pu.id = d.id;

UPDATE public.users pu
SET email = 'compounder_' || d.doctor_id || '@staff.clinic.local'
FROM public.compounders c
JOIN public.doctors d ON d.id = c.assigned_doctor_id
WHERE pu.id = c.id;
