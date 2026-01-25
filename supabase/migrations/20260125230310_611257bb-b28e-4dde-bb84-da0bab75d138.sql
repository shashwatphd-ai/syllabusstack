-- Fix overly permissive RLS policy for organizations INSERT
DROP POLICY IF EXISTS "System can create organizations" ON organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);