export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export type TaskRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by: string;
  creator_name: string | null;
  due_date: string | null;
  report_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

export type TaskAssignee = {
  user_id: string;
  full_name: string;
  position_title: string | null;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
};

export async function nameMap(
  supabase: any,
  ids: (string | null)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles_public")
    .select("id, full_name")
    .in("id", unique);
  return Object.fromEntries(
    (data ?? []).map((p: any) => [p.id, p.full_name || ""]),
  );
}

export function decorate(
  rows: any[],
  names: Record<string, string>,
): TaskRow[] {
  return rows.map((r) => ({
    id: r.id,
    company_id: r.company_id,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    priority: r.priority,
    assignee_id: r.assignee_id ?? null,
    assignee_name: r.assignee_id ? names[r.assignee_id] ?? null : null,
    created_by: r.created_by,
    creator_name: names[r.created_by] ?? null,
    due_date: r.due_date ?? null,
    report_id: r.report_id ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
