CREATE OR REPLACE FUNCTION get_auth_users_count() RETURNS integer AS $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM auth.users;
  RETURN c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
