CREATE OR REPLACE FUNCTION debug_user_row() RETURNS json AS $$
DECLARE
  res json;
BEGIN
  SELECT row_to_json(u) INTO res FROM auth.users u WHERE u.id = '29bc60bb-ab32-4a39-9370-64943739ed23';
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
