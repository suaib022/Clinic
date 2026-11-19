-- Fix for the Supabase security advisor note "function_search_path_mutable" on the lab helper (found after 20261118000000_lab_module.sql).
-- _lab_result only builds a JSON object (no table access, not SECURITY DEFINER), so this changes no behaviour; it just pins the search path.
ALTER FUNCTION public._lab_result(boolean, text, text, jsonb) SET search_path = public;
