-- report-attachments: owner
CREATE POLICY "report-attachments own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "report-attachments own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "report-attachments own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'report-attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "report-attachments own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);
-- DG read
CREATE POLICY "DG reads employee report attachments" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-attachments'
    AND EXISTS(
      SELECT 1 FROM public.report_attachments ra
      JOIN public.reports r ON r.id = ra.report_id
      WHERE ra.storage_path = name AND app_private.is_dg_of_user(auth.uid(), r.author_id)
    )
  );

-- company-proofs: owner
CREATE POLICY "users upload own company proofs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users read own company proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);