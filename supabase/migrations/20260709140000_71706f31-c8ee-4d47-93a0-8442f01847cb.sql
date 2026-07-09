
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Public profile view for author lookups
CREATE VIEW public.profiles_public AS SELECT id, full_name, avatar_url FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  title TEXT NOT NULL,
  intro TEXT DEFAULT '',
  conclusion TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports select all authenticated" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports insert own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "reports update own" ON public.reports FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "reports delete own" ON public.reports FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Report sections
CREATE TABLE public.report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.report_sections(report_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_sections TO authenticated;
GRANT ALL ON public.report_sections TO service_role;
ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections select" ON public.report_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections write own" ON public.report_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));

-- Section bullets
CREATE TABLE public.section_bullets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.report_sections(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX ON public.section_bullets(section_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.section_bullets TO authenticated;
GRANT ALL ON public.section_bullets TO service_role;
ALTER TABLE public.section_bullets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bullets select" ON public.section_bullets FOR SELECT TO authenticated USING (true);
CREATE POLICY "bullets write own" ON public.section_bullets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id WHERE s.id = section_id AND r.author_id = auth.uid()));

-- Report images
CREATE TABLE public.report_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.report_images(report_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_images TO authenticated;
GRANT ALL ON public.report_images TO service_role;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images select" ON public.report_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "images write own" ON public.report_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
