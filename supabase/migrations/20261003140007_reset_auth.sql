-- Revert the auth.users to original emails
UPDATE auth.users au
SET email = 'doctor' || d.id || '@labaid.com.bd'
FROM public.doctors d
WHERE au.id = d.id;

UPDATE auth.identities i
SET identity_data = identity_data || jsonb_build_object('email', 'doctor' || d.id || '@labaid.com.bd')
FROM public.doctors d
WHERE i.user_id = d.id AND i.provider = 'email';
