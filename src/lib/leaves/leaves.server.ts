import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveRequest } from "./types";

/** Noms d'affichage pour un lot d'identifiants utilisateur. */
export async function nameMap(
  supabase: SupabaseClient<any>,
  ids: (string | null | undefined)[],
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

/**
 * Détermine qui doit valider la demande d'un employé : son manager direct,
 * à défaut le propriétaire de l'entreprise.
 */
export async function resolveApprover(
  supabase: SupabaseClient<any>,
  companyId: string,
  userId: string,
): Promise<string | null> {
  const { data: me } = await supabase
    .from("company_members")
    .select("manager_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if ((me as any)?.manager_id) {
    const { data: mgr } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("id", (me as any).manager_id)
      .maybeSingle();
    const managerUser = (mgr as any)?.user_id as string | undefined;
    if (managerUser && managerUser !== userId) return managerUser;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();
  const owner = (company as any)?.owner_id as string | undefined;
  return owner && owner !== userId ? owner : null;
}

/** Vrai si l'utilisateur peut décider (manager direct ou propriétaire). */
export async function canDecide(
  supabase: SupabaseClient<any>,
  companyId: string,
  viewerId: string,
  targetUserId: string,
): Promise<boolean> {
  if (viewerId === targetUserId) return false;
  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();
  if ((company as any)?.owner_id === viewerId) return true;

  const { data: target } = await supabase
    .from("company_members")
    .select("manager_id")
    .eq("company_id", companyId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!(target as any)?.manager_id) return false;
  const { data: mgr } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("id", (target as any).manager_id)
    .maybeSingle();
  return (mgr as any)?.user_id === viewerId;
}

export type DecorateOptions = {
  viewerId: string;
  names: Record<string, string>;
  typeNames: Record<string, string>;
  comments?: Record<string, string | null>;
  decidableUserIds?: Set<string>;
};

/** Projette les lignes brutes en objets sûrs : le motif d'un collègue est masqué. */
export function decorate(rows: any[], opts: DecorateOptions): LeaveRequest[] {
  return rows.map((r) => {
    const isMine = r.user_id === opts.viewerId;
    const canSeeReason =
      isMine ||
      r.current_approver_id === opts.viewerId ||
      (opts.decidableUserIds?.has(r.user_id) ?? false);
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: opts.names[r.user_id] ?? null,
      type_id: r.type_id,
      type_name: opts.typeNames[r.type_id] ?? "Absence",
      start_date: r.start_date,
      end_date: r.end_date,
      half_start: !!r.half_start,
      half_end: !!r.half_end,
      days_count: Number(r.days_count ?? 0),
      reason: canSeeReason ? (r.reason ?? null) : null,
      has_proof: !!r.proof_path,
      status: r.status,
      current_approver_id: r.current_approver_id ?? null,
      approver_name: r.current_approver_id
        ? opts.names[r.current_approver_id] ?? null
        : null,
      submitted_at: r.submitted_at ?? null,
      decided_at: r.decided_at ?? null,
      created_at: r.created_at,
      decision_comment: opts.comments?.[r.id] ?? null,
      can_decide:
        !isMine &&
        r.status === "submitted" &&
        (r.current_approver_id === opts.viewerId ||
          (opts.decidableUserIds?.has(r.user_id) ?? false)),
      is_mine: isMine,
    };
  });
}

/** Identifiants des employés dont l'utilisateur peut valider les demandes. */
export async function decidableUserIds(
  supabase: SupabaseClient<any>,
  companyId: string,
  viewerId: string,
): Promise<Set<string>> {
  const result = new Set<string>();
  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();
  const { data: members } = await supabase
    .from("company_members")
    .select("id, user_id, manager_id")
    .eq("company_id", companyId);
  const rows = (members ?? []) as any[];

  if ((company as any)?.owner_id === viewerId) {
    rows.forEach((m) => {
      if (m.user_id !== viewerId) result.add(m.user_id);
    });
    return result;
  }

  const mine = rows.find((m) => m.user_id === viewerId);
  if (!mine) return result;
  rows
    .filter((m) => m.manager_id === mine.id && m.user_id !== viewerId)
    .forEach((m) => result.add(m.user_id));
  return result;
}
