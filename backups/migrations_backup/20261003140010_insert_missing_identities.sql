-- Insert missing auth.identities for all users in auth.users
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(), -- id is just a uuid, but often the provider_id is used. Let's use gen_random_uuid() for the PK
    id,
    jsonb_build_object('sub', id, 'email', email, 'email_verified', false),
    'email',
    id::text,
    now(),
    now(),
    now()
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = auth.users.id
);
