-- ============ 1. Hiérarchie sur company_members ============
ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS hierarchy_level integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS position_title text,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE public.company_members
  DROP CONSTRAINT IF EXISTS company_members_hierarchy_level_check;
ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_hierarchy_level_check CHECK (hierarchy_level BETWEEN 1 AND 4);

UPDATE public.company_members SET hierarchy_level = 1, position_title = COALESCE(position_title, 'Direction générale')
WHERE role = 'owner' AND hierarchy_level <> 1;

CREATE INDEX IF NOT EXISTS idx_company_members_manager ON public.company_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_level ON public.company_members(company_id, hierarchy_level);

-- Récupère la ligne company_members d'un utilisateur
CREATE OR REPLACE FUNCTION app_private.member_id_of(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.company_members WHERE user_id = _user LIMIT 1;
$$;

-- Vrai si _manager est, directement ou indirectement, au-dessus de _user
CREATE OR REPLACE FUNCTION app_private.is_manager_of(_manager uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH RECURSIVE chain AS (
    SELECT cm.id, cm.manager_id, cm.user_id, 0 AS depth
    FROM public.company_members cm
    WHERE cm.user_id = _user
    UNION ALL
    SELECT p.id, p.manager_id, p.user_id, c.depth + 1
    FROM public.company_members p
    JOIN chain c ON p.id = c.manager_id
    WHERE c.depth < 10
  )
  SELECT _manager IS NOT NULL AND _user IS NOT NULL AND _manager <> _user AND (
    EXISTS (SELECT 1 FROM chain WHERE depth > 0 AND user_id = _manager)
    OR app_private.is_dg_of_user(_manager, _user)
  );
$$;

REVOKE ALL ON FUNCTION app_private.member_id_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_manager_of(uuid, uuid) FROM PUBLIC;

-- Intégrité de l'organigramme
CREATE OR REPLACE FUNCTION public.validate_member_hierarchy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _mgr RECORD;
  _cursor uuid;
  _steps integer := 0;
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'Un membre ne peut pas être son propre supérieur.';
  END IF;
  SELECT id, company_id, hierarchy_level INTO _mgr FROM public.company_members WHERE id = NEW.manager_id;
  IF _mgr.id IS NULL THEN
    RAISE EXCEPTION 'Supérieur introuvable.';
  END IF;
  IF _mgr.company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'Le supérieur doit appartenir à la même entreprise.';
  END IF;
  IF _mgr.hierarchy_level >= NEW.hierarchy_level THEN
    RAISE EXCEPTION 'Le supérieur doit être à un niveau hiérarchique supérieur.';
  END IF;
  -- détection de boucle
  _cursor := NEW.manager_id;
  WHILE _cursor IS NOT NULL AND _steps < 20 LOOP
    IF _cursor = NEW.id THEN
      RAISE EXCEPTION 'Ce rattachement créerait une boucle dans l''organigramme.';
    END IF;
    SELECT manager_id INTO _cursor FROM public.company_members WHERE id = _cursor;
    _steps := _steps + 1;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_member_hierarchy() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_member_hierarchy ON public.company_members;
CREATE TRIGGER trg_validate_member_hierarchy
BEFORE INSERT OR UPDATE OF manager_id, hierarchy_level, company_id ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.validate_member_hierarchy();

-- Quand un membre part, ses subordonnés remontent à son supérieur
CREATE OR REPLACE FUNCTION public.reassign_subordinates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.company_members
  SET manager_id = OLD.manager_id
  WHERE manager_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.reassign_subordinates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reassign_subordinates ON public.company_members;
CREATE TRIGGER trg_reassign_subordinates
BEFORE DELETE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.reassign_subordinates();

-- ============ 2. Statuts & circuit sur reports ============
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS current_approver_id uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('draft','submitted','in_review','approved','rejected'));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_kind_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_kind_check
  CHECK (kind IN ('individual','consolidated'));

-- Reprise des données existantes : rapports déjà créés = validés
UPDATE public.reports r
SET status = 'approved',
    approved_at = COALESCE(r.approved_at, r.updated_at),
    submitted_at = COALESCE(r.submitted_at, r.created_at),
    company_id = COALESCE(r.company_id, app_private.get_user_company(r.author_id))
WHERE r.status = 'draft';

CREATE INDEX IF NOT EXISTS idx_reports_company_status ON public.reports(company_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_current_approver ON public.reports(current_approver_id);

-- ============ 3. Journal de validation ============
CREATE TABLE IF NOT EXISTS public.report_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL,
  level integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('submitted','approved','rejected')),
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_approvals TO authenticated;
GRANT ALL ON public.report_approvals TO service_role;
ALTER TABLE public.report_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auteur et hiérarchie lisent le journal"
ON public.report_approvals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_approvals.report_id
      AND (
        r.author_id = auth.uid()
        OR app_private.is_manager_of(auth.uid(), r.author_id)
        OR app_private.is_platform_admin(auth.uid())
      )
  )
);
CREATE INDEX IF NOT EXISTS idx_report_approvals_report ON public.report_approvals(report_id);

-- ============ 4. Rapports sources d'une synthèse ============
CREATE TABLE IF NOT EXISTS public.report_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidated_report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  source_report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consolidated_report_id, source_report_id)
);
GRANT SELECT ON public.report_sources TO authenticated;
GRANT ALL ON public.report_sources TO service_role;
ALTER TABLE public.report_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture des sources si accès à la synthèse"
ON public.report_sources FOR SELECT TO authenticated
USING (app_private.can_access_report(auth.uid(), consolidated_report_id, false));
CREATE INDEX IF NOT EXISTS idx_report_sources_consolidated ON public.report_sources(consolidated_report_id);

-- ============ 5. RLS : lecture de branche + valideur en cours ============
DROP POLICY IF EXISTS "Managers read branch reports" ON public.reports;
CREATE POLICY "Managers read branch reports"
ON public.reports FOR SELECT TO authenticated
USING (app_private.is_manager_of(auth.uid(), author_id));

DROP POLICY IF EXISTS "Current approver updates report" ON public.reports;
CREATE POLICY "Current approver updates report"
ON public.reports FOR UPDATE TO authenticated
USING (current_approver_id = auth.uid())
WITH CHECK (current_approver_id IS NOT DISTINCT FROM auth.uid() OR app_private.is_manager_of(auth.uid(), author_id));

-- Étendre l'accès aux sous-objets du rapport (sections, images, etc.) à la hiérarchie
CREATE OR REPLACE FUNCTION app_private.can_access_report(_user_id uuid, _report_id uuid, _need_edit boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.reports r WHERE r.id = _report_id AND r.author_id = _user_id)
  OR EXISTS (
    SELECT 1 FROM public.report_shares s
    WHERE s.report_id = _report_id AND s.shared_with = _user_id
      AND (NOT _need_edit OR s.permission = 'edit')
  )
  OR (NOT _need_edit AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = _report_id
      AND (app_private.is_dg_of_user(_user_id, r.author_id)
           OR app_private.is_manager_of(_user_id, r.author_id))
  ));
$$;