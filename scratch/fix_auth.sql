-- Disable the trigger so we don't conflict on public.users
ALTER TABLE auth.users DISABLE TRIGGER ALL;

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
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
FROM public.users u
WHERE u.role IN ('doctor', 'compounder')
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- Update passwords for those who ARE already in auth.users
UPDATE auth.users au
SET encrypted_password = crypt('123456', gen_salt('bf'))
FROM public.users u
WHERE au.id = u.id AND u.role IN ('doctor', 'compounder');

-- Re-enable triggers
ALTER TABLE auth.users ENABLE TRIGGER ALL;
