import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const PROJECT_STATUSES = [
  ["draft", "Cadrage / Idée"],
  ["planned", "Planifié"],
  ["active", "En cours"],
  ["paused", "En pause"],
  ["review", "En revue / Recette"],
  ["completed", "Terminé"],
] as const;
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(PROJECT_STATUSES);
export const PRIORITY_LABEL: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  critical: "Critique",
};
export const HEALTH_LABEL: Record<string, string> = {
  on_track: "Dans les temps",
  at_risk: "Vigilance",
  delayed: "En retard",
};
export const HEALTH_TONE: Record<string, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  delayed: "bg-destructive/15 text-destructive",
};
export const MILESTONE_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Franchi",
};

export type Project = {
  id: string;
  owner_id: string;
  company_id: string | null;
  code: string;
  title: string;
  client: string;
  category: string;
  priority: string;
  status: string;
  health: string;
  manager_name: string;
  start_date: string | null;
  end_date: string | null;
  context: string;
  objectives: string;
  deliverables: string;
  summary: string;
  budget: number;
  currency: string;
  progress: number;
  created_at: string;
};

export function fmtMoney(n: number, cur = "XOF") {
  const label = cur === "XOF" ? "FCFA" : cur;
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0))} ${label}`;
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await db.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProject(id: string) {
  const [p, m, t, b, f] = await Promise.all([
    db.from("projects").select("*").eq("id", id).maybeSingle(),
    db.from("project_milestones").select("*").eq("project_id", id).order("position"),
    db.from("project_members").select("*").eq("project_id", id).order("created_at"),
    db.from("project_budget_lines").select("*").eq("project_id", id).order("position"),
    db.from("project_files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  if (p.error) throw new Error(p.error.message);
  return {
    project: p.data as Project | null,
    milestones: (m.data ?? []) as any[],
    members: (t.data ?? []) as any[],
    budget: (b.data ?? []) as any[],
    files: (f.data ?? []) as any[],
  };
}

export async function createProject(input: Partial<Project>) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Non connecté");
  const { data: mem } = await db.from("company_members").select("company_id").eq("user_id", uid).limit(1).maybeSingle();
  const year = new Date().getFullYear();
  const { count } = await db.from("projects").select("id", { count: "exact", head: true });
  const code = `PRJ-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;
  const { data, error } = await db
    .from("projects")
    .insert({ ...input, owner_id: uid, company_id: mem?.company_id ?? null, code })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const { error } = await db.from("projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string) {
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addRow(table: string, row: Record<string, unknown>) {
  const { error } = await db.from(table).insert(row);
  if (error) throw new Error(error.message);
}
export async function updateRow(table: string, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from(table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteRow(table: string, id: string) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadProjectFile(projectId: string, file: File) {
  if (file.size > 30 * 1024 * 1024) throw new Error("Fichier trop volumineux (30 Mo max)");
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from("project-files").upload(path, file);
  if (up.error) throw new Error(up.error.message);
  await addRow("project_files", {
    project_id: projectId,
    storage_path: path,
    file_name: file.name,
    size_bytes: file.size,
    mime_type: file.type || null,
  });
}

export async function fileUrl(path: string) {
  const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function removeProjectFile(row: { id: string; storage_path: string }) {
  await supabase.storage.from("project-files").remove([row.storage_path]);
  await deleteRow("project_files", row.id);
}
