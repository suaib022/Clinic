ALTER TABLE public.doctors DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE public.compounders DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE public.patients DROP COLUMN IF EXISTS pin;
DROP FUNCTION IF EXISTS public.verify_user_pin(UUID, TEXT);
