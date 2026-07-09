DROP POLICY IF EXISTS "report-images own read" ON storage.objects;
CREATE POLICY "report-images authenticated read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-images');