-- Create storage bucket for lecture audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('lecture-audio', 'lecture-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read lecture audio (public playback)
CREATE POLICY "Anyone can read lecture audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'lecture-audio');

-- Authenticated users can upload audio (via edge function with service role, but allow auth users too)
CREATE POLICY "Authenticated users can upload lecture audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lecture-audio' AND auth.role() = 'authenticated');

-- Authenticated users can delete their audio
CREATE POLICY "Authenticated users can delete lecture audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'lecture-audio' AND auth.role() = 'authenticated');