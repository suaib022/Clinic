ALTER TABLE public.patients
ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id);

ALTER TABLE public.users
ALTER COLUMN role SET DEFAULT 'patient'::public.user_role;
