CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_read" ON public.ai_agents FOR SELECT TO authenticated USING (true);

INSERT INTO public.ai_agents (code,name,role,description,position) VALUES
('orchestrator','Orchestrateur IA','Directeur de mission','Comprend la demande, planifie, distribue les tâches, contrôle et décide de la publication.',0),
('collect','Agent de collecte','Collecte','Récupère les données réelles : projets, jalons, budgets, notes de frais, tâches et rapports de la période.',1),
('prepare','Agent de préparation','Normalisation','Harmonise dates et montants, détecte doublons et valeurs manquantes, sans modifier les sources.',2),
('analyze','Agent d''analyse','Calculs','Calculs déterministes : totaux, écarts, taux, retards. Aucun chiffre inventé.',3),
('quality','Agent de contrôle qualité','Contrôle','Vérifie complétude et cohérence : VALIDÉ, AVERTISSEMENT ou REJETÉ.',4),
('write','Agent de rédaction','Rédaction','Rédige la note fluide à partir des seuls résultats validés.',5),
('generate','Agent de génération','Génération','Crée le rapport final dans DailyBrief (vue web + PDF).',6)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  company_id uuid,
  report_type text NOT NULL,
  title text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  period_start date NOT NULL,
  period_end date NOT NULL,
  sources text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  current_step text,
  input_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_status text,
  error_summary text,
  result_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_runs_user_idx ON public.report_runs(requested_by, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_runs TO authenticated;
GRANT ALL ON public.report_runs TO service_role;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_own_select" ON public.report_runs FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE POLICY "runs_own_insert" ON public.report_runs FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE POLICY "runs_own_update" ON public.report_runs FOR UPDATE TO authenticated USING (requested_by = auth.uid()) WITH CHECK (requested_by = auth.uid());
CREATE POLICY "runs_own_delete" ON public.report_runs FOR DELETE TO authenticated USING (requested_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  agent_code text NOT NULL,
  task_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  output jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_tasks_run_idx ON public.agent_tasks(run_id, position);
GRANT SELECT, INSERT, UPDATE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON public.agent_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_runs r WHERE r.id = run_id AND r.requested_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_runs r WHERE r.id = run_id AND r.requested_by = auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_run_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS run_audit_idx ON public.report_run_audit_logs(run_id, created_at);
GRANT SELECT, INSERT ON public.report_run_audit_logs TO authenticated;
GRANT ALL ON public.report_run_audit_logs TO service_role;
ALTER TABLE public.report_run_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own_select" ON public.report_run_audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_runs r WHERE r.id = run_id AND r.requested_by = auth.uid()));
CREATE POLICY "audit_own_insert" ON public.report_run_audit_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_runs r WHERE r.id = run_id AND r.requested_by = auth.uid()));