-- Fix raw_app_meta_data for all auth.users
UPDATE auth.users
SET raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE raw_app_meta_data IS NULL;
