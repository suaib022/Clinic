INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a9bed1bc-1a4c-4cfe-be98-875545dfafd6',
    'authenticated',
    'authenticated',
    'compounder_doc-253316@staff.clinic.local',
    '$2a$10$w81.mY.bM0FfK1Tz2wV.Ue5J/62U2j/83wQe/n4x1u0D6V7f86nI2',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
) ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at;
