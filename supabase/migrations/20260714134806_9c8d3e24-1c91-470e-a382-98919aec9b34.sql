
-- Restrict SELECT on reports and children to the report author only
DROP POLICY IF EXISTS "reports select all authenticated" ON public.reports;
CREATE POLICY "reports select own" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "sections select" ON public.report_sections;
CREATE POLICY "sections select own" ON public.report_sections
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_sections.report_id AND r.author_id = auth.uid()));

DROP POLICY IF EXISTS "bullets select" ON public.section_bullets;
CREATE POLICY "bullets select own" ON public.section_bullets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.report_sections s
    JOIN public.reports r ON r.id = s.report_id
    WHERE s.id = section_bullets.section_id AND r.author_id = auth.uid()
  ));

DROP POLICY IF EXISTS "images select" ON public.report_images;
CREATE POLICY "images select own" ON public.report_images
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_images.report_id AND r.author_id = auth.uid()));

-- Restrict storage reads to files under the user's own folder
DROP POLICY IF EXISTS "report-images authenticated read" ON storage.objects;
CREATE POLICY "report-images own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'report-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
