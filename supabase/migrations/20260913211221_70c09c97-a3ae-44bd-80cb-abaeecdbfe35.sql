DROP POLICY IF EXISTS "ged_docs_insert_own" ON storage.objects;
CREATE POLICY "ged_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ged-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "ged_docs_select_own" ON storage.objects;
CREATE POLICY "ged_docs_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ged-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "ged_docs_delete_own" ON storage.objects;
CREATE POLICY "ged_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ged-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "expense_receipts_insert_own" ON storage.objects;
CREATE POLICY "expense_receipts_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "expense_receipts_select_own" ON storage.objects;
CREATE POLICY "expense_receipts_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "expense_receipts_delete_own" ON storage.objects;
CREATE POLICY "expense_receipts_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
