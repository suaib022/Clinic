-- Insert missing doctors and compounders into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  crypt('123456', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', u.full_name),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- Update passwords for those who ARE already in auth.users
UPDATE auth.users au
SET encrypted_password = crypt('123456', gen_salt('bf'))
FROM public.users u
WHERE au.id = u.id;

-- Insert missing identities so they can login via email
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
  gen_random_uuid(),
  au.id,
  format('{"sub": "%s", "email": "%s"}', au.id, au.email)::jsonb,
  'email',
  au.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users au
JOIN public.users u ON au.id = u.id
WHERE NOT EXISTS (SELECT 1 FROM auth.identities ai WHERE ai.user_id = au.id AND ai.provider = 'email');
