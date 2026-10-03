-- Fix auth.identities to match the updated email in auth.users
UPDATE auth.identities i
SET identity_data = identity_data || jsonb_build_object('email', u.email)
FROM auth.users u
WHERE i.user_id = u.id AND i.provider = 'email' AND i.identity_data->>'email' != u.email;
