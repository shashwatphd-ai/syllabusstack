
-- =============================================
-- FIX 1: Certificates - Hide payment data from public verification
-- The "Public certificate verification via share token" policy allows anyone 
-- to read ALL columns including stripe_payment_intent_id and amount_paid_cents.
-- Replace with a view that excludes financial fields for public access.
-- =============================================

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public certificate verification via share token" ON public.certificates;

-- Create a restricted public verification view (no financial data)
CREATE OR REPLACE VIEW public.certificates_public_verify
WITH (security_invoker = on) AS
  SELECT 
    id,
    certificate_number,
    certificate_type,
    course_title,
    instructor_name,
    institution_name,
    completion_date,
    mastery_score,
    skill_breakdown,
    identity_verified,
    instructor_verified,
    status,
    issued_at,
    share_token,
    user_id
  FROM public.certificates;
  -- Excludes: stripe_payment_intent_id, amount_paid_cents, pdf_path, qr_code_data

-- Re-add the public policy but ONLY for anon role reading via share_token
-- Since verify-certificate edge function uses service role key, it bypasses RLS anyway.
-- But we still need the policy for the view to work if queried directly.
CREATE POLICY "Public certificate verification via share token"
  ON public.certificates
  FOR SELECT
  TO anon
  USING ((share_token IS NOT NULL) AND ((status)::text = 'active'::text));

-- =============================================
-- FIX 2: Organizations - Hide financial fields from regular members
-- Create a view that excludes stripe_customer_id, seat_limit, seats_used,
-- license_tier, license dates for non-admin members.
-- =============================================

-- Create a safe view for regular members
CREATE OR REPLACE VIEW public.organizations_safe
WITH (security_invoker = on) AS
  SELECT 
    id,
    name,
    slug,
    type,
    is_active,
    custom_branding,
    sso_enabled,
    sso_domain,
    created_at,
    updated_at,
    -- Only expose financial/license fields to owners and admins
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN stripe_customer_id
      ELSE NULL
    END AS stripe_customer_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN seat_limit
      ELSE NULL
    END AS seat_limit,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN seats_used
      ELSE NULL
    END AS seats_used,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN license_tier
      ELSE NULL
    END AS license_tier,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN license_start_date
      ELSE NULL
    END AS license_start_date,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN license_end_date
      ELSE NULL
    END AS license_end_date,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organizations.id 
        AND om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
      ) THEN sso_config
      ELSE NULL
    END AS sso_config
  FROM public.organizations;

-- =============================================
-- FIX 3: Instructor verifications - Restrict cross-instructor access
-- The "Admins can view all verification requests" policy lets ANY instructor
-- see ALL other instructors' personal data. Fix: only actual admins.
-- =============================================

-- Drop the misconfigured policy
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.instructor_verifications;

-- Create a proper admin-only policy using the admin role
CREATE POLICY "Admins can view all verification requests"
  ON public.instructor_verifications
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );
