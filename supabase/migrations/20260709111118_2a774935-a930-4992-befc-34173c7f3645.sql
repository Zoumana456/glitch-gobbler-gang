
-- Utility function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reports viewable by authenticated"
  ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own reports"
  ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own reports"
  ON public.reports FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own reports"
  ON public.reports FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX reports_author_idx ON public.reports(author_id);
CREATE INDEX reports_date_idx ON public.reports(report_date DESC);

-- Helper: is caller the author of a given report?
CREATE OR REPLACE FUNCTION public.is_report_author(_report_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = _report_id AND r.author_id = auth.uid()
  );
$$;

-- REPORT SECTIONS
CREATE TABLE public.report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_sections TO authenticated;
GRANT ALL ON public.report_sections TO service_role;
ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sections viewable by authenticated"
  ON public.report_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Author manages sections insert"
  ON public.report_sections FOR INSERT TO authenticated WITH CHECK (public.is_report_author(report_id));
CREATE POLICY "Author manages sections update"
  ON public.report_sections FOR UPDATE TO authenticated USING (public.is_report_author(report_id)) WITH CHECK (public.is_report_author(report_id));
CREATE POLICY "Author manages sections delete"
  ON public.report_sections FOR DELETE TO authenticated USING (public.is_report_author(report_id));
CREATE INDEX report_sections_report_idx ON public.report_sections(report_id);

-- SECTION BULLETS
CREATE TABLE public.section_bullets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.report_sections(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.section_bullets TO authenticated;
GRANT ALL ON public.section_bullets TO service_role;
ALTER TABLE public.section_bullets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_section_author(_section_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.report_sections s
    JOIN public.reports r ON r.id = s.report_id
    WHERE s.id = _section_id AND r.author_id = auth.uid()
  );
$$;

CREATE POLICY "Bullets viewable by authenticated"
  ON public.section_bullets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Author manages bullets insert"
  ON public.section_bullets FOR INSERT TO authenticated WITH CHECK (public.is_section_author(section_id));
CREATE POLICY "Author manages bullets update"
  ON public.section_bullets FOR UPDATE TO authenticated USING (public.is_section_author(section_id)) WITH CHECK (public.is_section_author(section_id));
CREATE POLICY "Author manages bullets delete"
  ON public.section_bullets FOR DELETE TO authenticated USING (public.is_section_author(section_id));
CREATE INDEX section_bullets_section_idx ON public.section_bullets(section_id);

-- REPORT IMAGES
CREATE TABLE public.report_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_images TO authenticated;
GRANT ALL ON public.report_images TO service_role;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Images viewable by authenticated"
  ON public.report_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Author manages images insert"
  ON public.report_images FOR INSERT TO authenticated WITH CHECK (public.is_report_author(report_id));
CREATE POLICY "Author manages images update"
  ON public.report_images FOR UPDATE TO authenticated USING (public.is_report_author(report_id)) WITH CHECK (public.is_report_author(report_id));
CREATE POLICY "Author manages images delete"
  ON public.report_images FOR DELETE TO authenticated USING (public.is_report_author(report_id));
CREATE INDEX report_images_report_idx ON public.report_images(report_id);
CREATE INDEX report_images_section_idx ON public.report_images(section_id);
