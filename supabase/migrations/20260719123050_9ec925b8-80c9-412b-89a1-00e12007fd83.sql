-- ============ profiles_public view (used by search/shares UI) ============
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, full_name, avatar_url FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

-- ============ REPORT ATTACHMENTS ============
CREATE TABLE public.report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_attachments_report_idx ON public.report_attachments(report_id);
CREATE INDEX report_attachments_section_idx ON public.report_attachments(section_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_attachments TO authenticated;
GRANT ALL ON public.report_attachments TO service_role;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments select own" ON public.report_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_attachments.report_id AND r.author_id = auth.uid()));
CREATE POLICY "attachments write own" ON public.report_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid()));

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_limit INTEGER NOT NULL DEFAULT 10 CHECK (seat_limit > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ COMPANY MEMBERS ============
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','employee')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id),
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- ============ INVITATIONS ============
CREATE TABLE public.company_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_invitations_token ON public.company_invitations(token);
CREATE INDEX idx_company_invitations_email ON public.company_invitations(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invitations TO authenticated;
GRANT ALL ON public.company_invitations TO service_role;
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

-- ============ PLATFORM ADMINS ============
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ============ REPORT NOTES ============
CREATE TABLE public.report_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.report_sections(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_notes_report ON public.report_notes(report_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_notes TO authenticated;
GRANT ALL ON public.report_notes TO service_role;
ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_report_notes_updated_at BEFORE UPDATE ON public.report_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ app_private SCHEMA + HELPERS ============
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO postgres, service_role, authenticated;

CREATE OR REPLACE FUNCTION app_private.is_company_owner(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = _company AND owner_id = _user);
$$;
CREATE OR REPLACE FUNCTION app_private.is_company_member(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company);
$$;
CREATE OR REPLACE FUNCTION app_private.get_user_company(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members WHERE user_id = _user LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION app_private.is_dg_of_user(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.user_id = _target AND c.owner_id = _viewer
  );
$$;
CREATE OR REPLACE FUNCTION app_private.is_platform_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = _user);
$$;
CREATE OR REPLACE FUNCTION app_private.is_report_author(_user_id uuid, _report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.reports WHERE id = _report_id AND author_id = _user_id);
$$;

REVOKE ALL ON FUNCTION
  app_private.is_company_owner(uuid, uuid),
  app_private.is_company_member(uuid, uuid),
  app_private.get_user_company(uuid),
  app_private.is_dg_of_user(uuid, uuid),
  app_private.is_platform_admin(uuid),
  app_private.is_report_author(uuid, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  app_private.is_company_owner(uuid, uuid),
  app_private.is_company_member(uuid, uuid),
  app_private.get_user_company(uuid),
  app_private.is_dg_of_user(uuid, uuid),
  app_private.is_platform_admin(uuid),
  app_private.is_report_author(uuid, uuid)
TO authenticated, service_role;

-- ============ SEAT LIMIT ============
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _limit INTEGER;
  _count INTEGER;
BEGIN
  SELECT seat_limit INTO _limit FROM public.companies WHERE id = NEW.company_id;
  SELECT COUNT(*) INTO _count FROM public.company_members WHERE company_id = NEW.company_id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'Nombre de sièges dépassé (%/%) pour cette entreprise', _count, _limit;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_seat_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_seat_limit BEFORE INSERT ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

-- ============ POLICIES: companies ============
CREATE POLICY "Owner reads own company" ON public.companies FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Users create own company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates own company" ON public.companies FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes own company" ON public.companies FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Platform admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (app_private.is_platform_admin(auth.uid())) WITH CHECK (app_private.is_platform_admin(auth.uid()));

-- ============ POLICIES: company_members ============
CREATE POLICY "Members read own memberships" ON public.company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.is_company_owner(auth.uid(), company_id));
CREATE POLICY "Owner inserts members" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (app_private.is_company_owner(auth.uid(), company_id));
CREATE POLICY "Owner updates members" ON public.company_members FOR UPDATE TO authenticated
  USING (app_private.is_company_owner(auth.uid(), company_id))
  WITH CHECK (app_private.is_company_owner(auth.uid(), company_id));
CREATE POLICY "Owner removes members" ON public.company_members FOR DELETE TO authenticated
  USING (app_private.is_company_owner(auth.uid(), company_id));

-- ============ POLICIES: company_invitations ============
CREATE POLICY "Owner reads own invitations" ON public.company_invitations FOR SELECT TO authenticated
  USING (app_private.is_company_owner(auth.uid(), company_id));
CREATE POLICY "Owner creates invitations" ON public.company_invitations FOR INSERT TO authenticated
  WITH CHECK (app_private.is_company_owner(auth.uid(), company_id) AND invited_by = auth.uid());
CREATE POLICY "Owner updates invitations" ON public.company_invitations FOR UPDATE TO authenticated
  USING (app_private.is_company_owner(auth.uid(), company_id))
  WITH CHECK (app_private.is_company_owner(auth.uid(), company_id));
CREATE POLICY "Owner deletes invitations" ON public.company_invitations FOR DELETE TO authenticated
  USING (app_private.is_company_owner(auth.uid(), company_id));

-- ============ POLICIES: platform_admins ============
CREATE POLICY "Admins read admin list" ON public.platform_admins FOR SELECT TO authenticated
  USING (app_private.is_platform_admin(auth.uid()));

-- ============ POLICIES: profiles (DG read) ============
CREATE POLICY "DG reads employee profiles" ON public.profiles FOR SELECT TO authenticated
  USING (app_private.is_dg_of_user(auth.uid(), id));

-- ============ POLICIES: report_notes ============
CREATE POLICY "DG creates notes on employee reports" ON public.report_notes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id))
  );
CREATE POLICY "DG updates own notes" ON public.report_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "DG deletes own notes" ON public.report_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "DG and report author read notes" ON public.report_notes FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid())
    OR EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id))
  );

-- ============ Extend existing reports policies for DG read ============
CREATE POLICY "DG reads employee reports" ON public.reports FOR SELECT TO authenticated
  USING (app_private.is_dg_of_user(auth.uid(), author_id));
CREATE POLICY "DG reads employee sections" ON public.report_sections FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id)));
CREATE POLICY "DG reads employee bullets" ON public.section_bullets FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.report_sections s JOIN public.reports r ON r.id = s.report_id
    WHERE s.id = section_id AND app_private.is_dg_of_user(auth.uid(), r.author_id)
  ));
CREATE POLICY "DG reads employee images" ON public.report_images FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id)));
CREATE POLICY "DG reads employee attachments" ON public.report_attachments FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.reports r WHERE r.id = report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id)));

-- ============ REPORT MINUTES ============
CREATE TABLE public.report_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number text NOT NULL DEFAULT '',
  held_at timestamptz NOT NULL DEFAULT now(),
  location text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  facts text NOT NULL DEFAULT '',
  decisions text NOT NULL DEFAULT '',
  signer_name text NOT NULL DEFAULT '',
  signer_role text NOT NULL DEFAULT '',
  signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_minutes_report ON public.report_minutes(report_id);
CREATE INDEX idx_report_minutes_author ON public.report_minutes(author_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_minutes TO authenticated;
GRANT ALL ON public.report_minutes TO service_role;
ALTER TABLE public.report_minutes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_report_minutes_updated_at BEFORE UPDATE ON public.report_minutes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "minutes_select_author_or_dg" ON public.report_minutes FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR app_private.is_dg_of_user(auth.uid(), author_id));
CREATE POLICY "minutes_insert_own" ON public.report_minutes FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.author_id = auth.uid())
  );
CREATE POLICY "minutes_update_own" ON public.report_minutes FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "minutes_delete_own" ON public.report_minutes FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ============ REPORT SHARES (nominatifs) ============
CREATE TABLE public.report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view','edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, shared_with)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_shares TO authenticated;
GRANT ALL ON public.report_shares TO service_role;
CREATE INDEX report_shares_report_id_idx ON public.report_shares(report_id);
CREATE INDEX report_shares_shared_with_idx ON public.report_shares(shared_with);
CREATE TRIGGER report_shares_updated_at BEFORE UPDATE ON public.report_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.can_access_report(_user_id UUID, _report_id UUID, _need_edit BOOLEAN)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.reports r WHERE r.id = _report_id AND r.author_id = _user_id)
  OR EXISTS (
    SELECT 1 FROM public.report_shares s
    WHERE s.report_id = _report_id AND s.shared_with = _user_id
      AND (NOT _need_edit OR s.permission = 'edit')
  )
  OR (NOT _need_edit AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = _report_id AND app_private.is_dg_of_user(_user_id, r.author_id)
  ));
$$;
REVOKE ALL ON FUNCTION app_private.can_access_report(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_access_report(UUID, UUID, BOOLEAN) TO authenticated;

CREATE POLICY "shares select involved" ON public.report_shares FOR SELECT TO authenticated
USING (
  shared_by = auth.uid() OR shared_with = auth.uid()
  OR app_private.is_report_author(auth.uid(), report_id)
);
CREATE POLICY "shares insert by allowed" ON public.report_shares FOR INSERT TO authenticated
WITH CHECK (
  shared_by = auth.uid() AND shared_with <> auth.uid()
  AND (app_private.is_report_author(auth.uid(), report_id) OR app_private.is_dg_of_user(auth.uid(), shared_with))
);
CREATE POLICY "shares update own" ON public.report_shares FOR UPDATE TO authenticated
USING (shared_by = auth.uid()) WITH CHECK (shared_by = auth.uid());
CREATE POLICY "shares delete own or author" ON public.report_shares FOR DELETE TO authenticated
USING (shared_by = auth.uid() OR app_private.is_report_author(auth.uid(), report_id));

-- Extend reports for share recipients
CREATE POLICY "reports select shared" ON public.reports FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = reports.id AND s.shared_with = auth.uid()));
CREATE POLICY "reports update shared edit" ON public.reports FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = reports.id AND s.shared_with = auth.uid() AND s.permission = 'edit'))
WITH CHECK (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = reports.id AND s.shared_with = auth.uid() AND s.permission = 'edit'));

CREATE POLICY "sections select shared" ON public.report_sections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_sections.report_id AND s.shared_with = auth.uid()));
CREATE POLICY "sections write shared edit" ON public.report_sections FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_sections.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'))
WITH CHECK (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_sections.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'));

CREATE POLICY "images select shared" ON public.report_images FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_images.report_id AND s.shared_with = auth.uid()));
CREATE POLICY "images write shared edit" ON public.report_images FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_images.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'))
WITH CHECK (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_images.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'));

CREATE POLICY "attachments select shared" ON public.report_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_attachments.report_id AND s.shared_with = auth.uid()));
CREATE POLICY "attachments write shared edit" ON public.report_attachments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_attachments.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'))
WITH CHECK (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_attachments.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'));

CREATE POLICY "bullets select shared" ON public.section_bullets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.report_sections sec
  JOIN public.report_shares s ON s.report_id = sec.report_id
  WHERE sec.id = section_bullets.section_id AND s.shared_with = auth.uid()
));
CREATE POLICY "bullets write shared edit" ON public.section_bullets FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.report_sections sec
  JOIN public.report_shares s ON s.report_id = sec.report_id
  WHERE sec.id = section_bullets.section_id AND s.shared_with = auth.uid() AND s.permission = 'edit'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.report_sections sec
  JOIN public.report_shares s ON s.report_id = sec.report_id
  WHERE sec.id = section_bullets.section_id AND s.shared_with = auth.uid() AND s.permission = 'edit'
));

-- Minutes: DG + shared
CREATE POLICY "minutes_select_shared" ON public.report_minutes FOR SELECT TO authenticated
USING (app_private.can_access_report(auth.uid(), report_id, false));
CREATE POLICY "minutes_insert_shared_edit" ON public.report_minutes FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND app_private.can_access_report(auth.uid(), report_id, true));
CREATE POLICY "minutes_update_shared_edit" ON public.report_minutes FOR UPDATE TO authenticated
USING (app_private.can_access_report(auth.uid(), report_id, true))
WITH CHECK (app_private.can_access_report(auth.uid(), report_id, true));
CREATE POLICY "minutes_delete_shared_edit" ON public.report_minutes FOR DELETE TO authenticated
USING (app_private.can_access_report(auth.uid(), report_id, true));

-- Storage: DG reads employee report-images
CREATE POLICY "DG reads employee report images" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'report-images'
  AND EXISTS(
    SELECT 1 FROM public.report_images ri
    JOIN public.reports r ON r.id = ri.report_id
    WHERE ri.storage_path = name AND app_private.is_dg_of_user(auth.uid(), r.author_id)
  )
);

-- ============ RESERVED NAMES + VERIFICATIONS ============
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION app_private.normalize_company_name(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(unaccent(coalesce(_name, ''))), '[^a-z0-9]+', '', 'g')
$$;
GRANT EXECUTE ON FUNCTION app_private.normalize_company_name(text) TO authenticated, service_role;

CREATE TABLE public.reserved_company_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reserved_company_names TO authenticated;
GRANT ALL ON public.reserved_company_names TO service_role;
ALTER TABLE public.reserved_company_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read reserved names" ON public.reserved_company_names FOR SELECT
  TO authenticated USING (true);

CREATE TABLE public.company_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  proof_path text,
  message text,
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cvr_user_idx ON public.company_verification_requests(user_id);
CREATE INDEX cvr_slug_idx ON public.company_verification_requests(slug);
CREATE INDEX cvr_status_idx ON public.company_verification_requests(status);
GRANT SELECT, INSERT ON public.company_verification_requests TO authenticated;
GRANT ALL ON public.company_verification_requests TO service_role;
ALTER TABLE public.company_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own verification requests" ON public.company_verification_requests FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users insert own verification requests" ON public.company_verification_requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE TRIGGER cvr_set_updated_at BEFORE UPDATE ON public.company_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.reserved_company_names (slug, display_name) VALUES
  ('jumia','Jumia'),('amazon','Amazon'),('facebook','Facebook'),('meta','Meta'),
  ('google','Google'),('apple','Apple'),('microsoft','Microsoft'),('netflix','Netflix'),
  ('orange','Orange'),('mtn','MTN'),('moov','Moov'),('airtel','Airtel'),
  ('safaricom','Safaricom'),('ecobank','Ecobank'),('wave','Wave'),('paypal','PayPal'),
  ('stripe','Stripe'),('uber','Uber'),('bolt','Bolt'),('tiktok','TikTok'),
  ('twitter','Twitter'),('x','X'),('instagram','Instagram'),('whatsapp','WhatsApp'),
  ('openai','OpenAI'),('lovable','Lovable'),('youtube','YouTube'),('linkedin','LinkedIn'),
  ('snapchat','Snapchat'),('samsung','Samsung'),('huawei','Huawei'),('sony','Sony'),
  ('tesla','Tesla'),('nike','Nike'),('adidas','Adidas'),('cocacola','Coca-Cola'),
  ('pepsi','Pepsi')
ON CONFLICT (slug) DO NOTHING;