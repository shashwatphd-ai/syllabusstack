-- Drop the profiles_public view which exposes sensitive PII (email, university, major)
-- to any authenticated user who can pass the underlying RLS policies.
-- This view is unused in application code. Use profiles_safe for own-profile access
-- and profiles_minimal for cross-user displays.
DROP VIEW IF EXISTS public.profiles_public;