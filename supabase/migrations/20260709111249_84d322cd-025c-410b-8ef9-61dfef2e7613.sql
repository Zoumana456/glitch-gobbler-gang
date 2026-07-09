
-- Drop old policies that used the helper functions
DROP POLICY IF EXISTS "Author manages sections insert" ON public.report_sections;
DROP POLICY IF EXISTS "Author manages sections update" ON public.report_sections;
DROP POLICY IF EXISTS "Author manages sections delete" ON public.report_sections;
DROP POLICY IF EXISTS "Author manages bullets insert" ON public.section_bullets;
DROP POLICY IF EXISTS "Author manages bullets update" ON public.section_bullets;
DROP POLICY IF EXISTS "Author manages bullets delete" ON public.section_bullets;
DROP POLICY IF EXISTS "Author manages images insert" ON public.report_images;
DROP POLICY IF EXISTS "Author manages images update" ON public.report_images;
DROP POLICY IF EXISTS "Author manages images delete" ON public.report_images;

-- Drop helper functions (security warning)
DROP FUNCTION IF EXISTS public.is_report_author(UUID);
DROP FUNCTION IF EXISTS public.is_section_author(UUID);

-- Recreate policies with inline EXISTS
CREATE POLICY "Author manages sections insert" ON public.report_sections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages sections update" ON public.report_sections FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages sections delete" ON public.report_sections FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));

CREATE POLICY "Author manages bullets insert" ON public.section_bullets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages bullets update" ON public.section_bullets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages bullets delete" ON public.section_bullets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()));

CREATE POLICY "Author manages images insert" ON public.report_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages images update" ON public.report_images FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));
CREATE POLICY "Author manages images delete" ON public.report_images FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));

-- Storage policies for the report-images bucket
CREATE POLICY "Report images readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-images');

CREATE POLICY "Users upload their own report images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-images' AND owner = auth.uid());

CREATE POLICY "Users delete their own report images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-images' AND owner = auth.uid());
