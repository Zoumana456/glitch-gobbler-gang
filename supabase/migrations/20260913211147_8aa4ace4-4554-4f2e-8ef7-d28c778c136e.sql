-- ============ DOCUMENTS (GED) ============
CREATE TABLE IF NOT EXISTS public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "folders_select_company" ON public.document_folders;
CREATE POLICY "folders_select_company" ON public.document_folders FOR SELECT TO authenticated
  USING (app_private.is_company_member(auth.uid(), company_id) OR app_private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "folders_insert_company" ON public.document_folders;
CREATE POLICY "folders_insert_company" ON public.document_folders FOR INSERT TO authenticated
  WITH CHECK (app_private.is_company_member(auth.uid(), company_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS "folders_update_owner" ON public.document_folders;
CREATE POLICY "folders_update_owner" ON public.document_folders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR app_private.is_company_owner(auth.uid(), company_id) OR app_private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "folders_delete_owner" ON public.document_folders;
CREATE POLICY "folders_delete_owner" ON public.document_folders FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR app_private.is_company_owner(auth.uid(), company_id) OR app_private.is_platform_admin(auth.uid()));

DROP TRIGGER IF EXISTS document_folders_set_updated_at ON public.document_folders;
CREATE TRIGGER document_folders_set_updated_at BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS documents_company_idx ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS documents_folder_idx ON public.documents(folder_id);

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs peuvent voir tous les documents" ON public.documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent insérer des documents" ON public.documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leurs documents" ON public.documents;

DROP POLICY IF EXISTS "documents_select_scope" ON public.documents;
CREATE POLICY "documents_select_scope" ON public.documents FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR app_private.is_platform_admin(auth.uid())
    OR (
      company_id IS NOT NULL
      AND app_private.is_company_member(auth.uid(), company_id)
      AND (visibility <> 'private' OR app_private.is_company_owner(auth.uid(), company_id))
    )
  );
DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (company_id IS NULL OR app_private.is_company_member(auth.uid(), company_id))
  );
DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own" ON public.documents FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id))
    OR app_private.is_platform_admin(auth.uid())
  );
DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id))
    OR app_private.is_platform_admin(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
GRANT SELECT, INSERT ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_versions_select" ON public.document_versions;
CREATE POLICY "doc_versions_select" ON public.document_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id));
DROP POLICY IF EXISTS "doc_versions_insert" ON public.document_versions;
CREATE POLICY "doc_versions_insert" ON public.document_versions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (d.author_id = auth.uid() OR (d.company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), d.company_id))))
  );

-- ============ DEPENSES / NOTES DE FRAIS ============
ALTER TABLE public.expense_reports
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS decision_comment text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid;

ALTER TABLE public.expense_reports ALTER COLUMN status SET DEFAULT 'submitted';
CREATE INDEX IF NOT EXISTS expense_reports_company_idx ON public.expense_reports(company_id);

DROP TRIGGER IF EXISTS expense_reports_set_updated_at ON public.expense_reports;
CREATE TRIGGER expense_reports_set_updated_at BEFORE UPDATE ON public.expense_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO authenticated;
GRANT ALL ON public.expense_reports TO service_role;
ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own expenses" ON public.expense_reports;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expense_reports;
DROP POLICY IF EXISTS "Users can update their own pending expenses" ON public.expense_reports;

DROP POLICY IF EXISTS "expenses_select_scope" ON public.expense_reports;
CREATE POLICY "expenses_select_scope" ON public.expense_reports FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR manager_id = auth.uid()
    OR app_private.is_manager_of(auth.uid(), author_id)
    OR app_private.is_dg_of_user(auth.uid(), author_id)
    OR app_private.is_platform_admin(auth.uid())
  );
DROP POLICY IF EXISTS "expenses_insert_own" ON public.expense_reports;
CREATE POLICY "expenses_insert_own" ON public.expense_reports FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "expenses_update_scope" ON public.expense_reports;
CREATE POLICY "expenses_update_scope" ON public.expense_reports FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid() AND status IN ('draft', 'submitted', 'En attente'))
    OR manager_id = auth.uid()
    OR app_private.is_manager_of(auth.uid(), author_id)
    OR app_private.is_dg_of_user(auth.uid(), author_id)
    OR app_private.is_platform_admin(auth.uid())
  );
DROP POLICY IF EXISTS "expenses_delete_own" ON public.expense_reports;
CREATE POLICY "expenses_delete_own" ON public.expense_reports FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status IN ('draft', 'submitted', 'En attente'));
