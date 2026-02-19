
-- Create a temporary storage bucket for seed files
INSERT INTO storage.buckets (id, name, public) VALUES ('seed-files', 'seed-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to read seed files
CREATE POLICY "Service role can read seed files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'seed-files');

-- Allow service role to insert seed files
CREATE POLICY "Service role can insert seed files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'seed-files');
