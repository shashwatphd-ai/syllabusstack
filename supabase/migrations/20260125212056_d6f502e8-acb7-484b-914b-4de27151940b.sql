-- Phase 0: Certificate System Database Schema

-- Certificates table: Stores all issued certificates
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instructor_course_id UUID NOT NULL REFERENCES public.instructor_courses(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  certificate_number VARCHAR(20) UNIQUE NOT NULL, -- SS-XXXXXX format
  certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('completion_badge', 'verified', 'assessed')),
  mastery_score DECIMAL(5,2), -- For assessed tier (0-100)
  skill_breakdown JSONB, -- {"skill_name": score, ...}
  identity_verified BOOLEAN DEFAULT FALSE,
  instructor_verified BOOLEAN DEFAULT FALSE,
  course_title VARCHAR(255) NOT NULL,
  instructor_name VARCHAR(255),
  institution_name VARCHAR(255),
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pdf_path TEXT, -- Storage path for generated PDF
  qr_code_data TEXT, -- QR code payload
  share_token VARCHAR(100) UNIQUE NOT NULL, -- For public verification URL
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  stripe_payment_intent_id VARCHAR(255), -- For paid certificates
  amount_paid_cents INTEGER DEFAULT 0,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proctored sessions: Track browser lockdown during assessments
CREATE TABLE public.proctored_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fullscreen_exits INTEGER DEFAULT 0,
  tab_switches INTEGER DEFAULT 0,
  copy_paste_attempts INTEGER DEFAULT 0,
  browser_focus_losses INTEGER DEFAULT 0,
  webcam_enabled BOOLEAN DEFAULT FALSE,
  webcam_snapshots_count INTEGER DEFAULT 0,
  proctoring_passed BOOLEAN,
  violation_threshold INTEGER DEFAULT 3, -- Max violations before fail
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificate verifications: Audit log for verification requests
CREATE TABLE public.certificate_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  verified_via VARCHAR(30) NOT NULL CHECK (verified_via IN ('public_page', 'qr_code', 'employer_api', 'linkedin')),
  verifier_ip INET,
  verifier_user_agent TEXT,
  employer_account_id UUID, -- For API verifications
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX idx_certificates_instructor_course_id ON public.certificates(instructor_course_id);
CREATE INDEX idx_certificates_share_token ON public.certificates(share_token);
CREATE INDEX idx_certificates_certificate_number ON public.certificates(certificate_number);
CREATE INDEX idx_proctored_sessions_assessment_session_id ON public.proctored_sessions(assessment_session_id);
CREATE INDEX idx_proctored_sessions_user_id ON public.proctored_sessions(user_id);
CREATE INDEX idx_certificate_verifications_certificate_id ON public.certificate_verifications(certificate_id);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctored_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificates
CREATE POLICY "Users can view their own certificates"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own certificates"
  ON public.certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors can view certificates for their courses"
  ON public.certificates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_courses ic
      WHERE ic.id = instructor_course_id
      AND ic.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Public certificate verification via share token"
  ON public.certificates FOR SELECT
  USING (share_token IS NOT NULL AND status = 'active');

-- RLS Policies for proctored_sessions
CREATE POLICY "Users can view their own proctored sessions"
  ON public.proctored_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proctored sessions"
  ON public.proctored_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proctored sessions"
  ON public.proctored_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for certificate_verifications (public insert for tracking)
CREATE POLICY "Anyone can insert verification records"
  ON public.certificate_verifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Certificate owners can view verification history"
  ON public.certificate_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.certificates c
      WHERE c.id = certificate_id
      AND c.user_id = auth.uid()
    )
  );

-- Function to generate unique certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_number TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate SS-XXXXXX format (6 alphanumeric chars)
    v_number := 'SS-' || upper(substring(md5(random()::text) from 1 for 6));
    
    SELECT EXISTS(SELECT 1 FROM certificates WHERE certificate_number = v_number) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_number;
    END IF;
  END LOOP;
END;
$$;

-- Function to generate share token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 32 char random token
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');
    v_token := substring(v_token from 1 for 32);
    
    SELECT EXISTS(SELECT 1 FROM certificates WHERE share_token = v_token) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add certificate_id to course_enrollments for tracking
ALTER TABLE public.course_enrollments 
ADD COLUMN IF NOT EXISTS certificate_id UUID REFERENCES public.certificates(id),
ADD COLUMN IF NOT EXISTS certificate_eligible BOOLEAN DEFAULT FALSE;