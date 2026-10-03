CREATE OR REPLACE FUNCTION debug_identities() RETURNS json AS $$
DECLARE
  res json;
BEGIN
  SELECT json_agg(i) INTO res FROM auth.identities i WHERE i.user_id = '29bc60bb-ab32-4a39-9370-64943739ed23';
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
