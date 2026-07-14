
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- Public read via share_token on reports
CREATE POLICY "Public can view shared reports"
ON public.reports FOR SELECT
TO anon, authenticated
USING (share_token IS NOT NULL);

GRANT SELECT ON public.reports TO anon;

-- Related sections readable when parent report is shared
CREATE POLICY "Public can view sections of shared reports"
ON public.report_sections FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_sections.report_id AND r.share_token IS NOT NULL));

GRANT SELECT ON public.report_sections TO anon;

CREATE POLICY "Public can view bullets of shared reports"
ON public.section_bullets FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.report_sections s
  JOIN public.reports r ON r.id = s.report_id
  WHERE s.id = section_bullets.section_id AND r.share_token IS NOT NULL
));

GRANT SELECT ON public.section_bullets TO anon;

CREATE POLICY "Public can view images of shared reports"
ON public.report_images FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_images.report_id AND r.share_token IS NOT NULL));

GRANT SELECT ON public.report_images TO anon;
