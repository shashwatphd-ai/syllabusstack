-- Create storage bucket for lecture visuals
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lecture-visuals',
  'lecture-visuals',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);

-- Create storage policies for lecture-visuals bucket
CREATE POLICY "Instructors can upload lecture visuals"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lecture-visuals' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view lecture visuals"
ON storage.objects
FOR SELECT
USING (bucket_id = 'lecture-visuals');

CREATE POLICY "Instructors can update their lecture visuals"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lecture-visuals' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Instructors can delete their lecture visuals"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lecture-visuals' 
  AND auth.role() = 'authenticated'
);