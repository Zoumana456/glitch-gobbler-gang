CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION app_private.normalize_company_name(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = extensions, public AS $$
  SELECT regexp_replace(lower(extensions.unaccent(coalesce(_name, ''))), '[^a-z0-9]+', '', 'g')
$$;