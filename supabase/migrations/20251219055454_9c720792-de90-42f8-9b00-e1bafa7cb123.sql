-- Phase 2: Supabase Storage Setup for Syllabi

-- 2.1 Create syllabi storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'syllabi', 
  'syllabi', 
  false, 
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- 2.2 Storage RLS Policies - Users can upload their own syllabi
CREATE POLICY "Users can upload syllabi" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 2.3 Users can view their own syllabi
CREATE POLICY "Users can view their syllabi" ON storage.objects
FOR SELECT USING (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 2.4 Users can update their own syllabi
CREATE POLICY "Users can update their syllabi" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 2.5 Users can delete their own syllabi
CREATE POLICY "Users can delete their syllabi" ON storage.objects
FOR DELETE USING (
  bucket_id = 'syllabi' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);