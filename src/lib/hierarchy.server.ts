import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MemberRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: "owner" | "employee";
  hierarchy_level: number;
  manager_id: string | null;
  position_title: string | null;
  department: string | null;
  joined_at: string;
};

/** Ligne company_members de l'utilisateur, ou null s'il n'appartient à aucune entreprise. */
export async function getMemberRow(userId: string): Promise<MemberRow | null> {
  const { data } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, user_id, role, hierarchy_level, manager_id, position_title, department, joined_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as MemberRow) ?? null;
}

/** Tous les membres d'une entreprise. */
export async function listMembers(companyId: string): Promise<MemberRow[]> {
  const { data } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, user_id, role, hierarchy_level, manager_id, position_title, department, joined_at")
    .eq("company_id", companyId)
    .order("hierarchy_level", { ascending: true });
  return (data ?? []) as MemberRow[];
}

/** Noms d'affichage pour un lot d'utilisateurs. */
export async function nameMap(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  return Object.fromEntries(
    (data ?? []).map((p: any) => [p.id, p.full_name || p.email?.split("@")[0] || "Utilisateur"]),
  );
}

/** Membre de niveau 1 (DG) de l'entreprise. */
export function findTopMember(members: MemberRow[]): MemberRow | null {
  const byLevel = [...members].sort((a, b) => a.hierarchy_level - b.hierarchy_level);
  return byLevel.find((m) => m.hierarchy_level === 1) ?? byLevel[0] ?? null;
}

/**
 * Prochain valideur au-dessus de `member` : son supérieur direct,
 * sinon le premier membre d'un niveau supérieur (fallback vers le DG).
 * Retourne null si `member` est déjà au sommet.
 */
export function nextApproverOf(members: MemberRow[], member: MemberRow): MemberRow | null {
  if (member.manager_id) {
    const mgr = members.find((m) => m.id === member.manager_id);
    if (mgr && mgr.hierarchy_level < member.hierarchy_level) return mgr;
  }
  if (member.hierarchy_level <= 1) return null;
  const above = members
    .filter((m) => m.hierarchy_level < member.hierarchy_level && m.id !== member.id)
    .sort((a, b) => b.hierarchy_level - a.hierarchy_level);
  return above[0] ?? null;
}

/** Ids des subordonnés directs et indirects (company_members.id). */
export function descendantIds(members: MemberRow[], rootMemberId: string): Set<string> {
  const children: Record<string, string[]> = {};
  members.forEach((m) => {
    if (m.manager_id) (children[m.manager_id] ??= []).push(m.id);
  });
  const out = new Set<string>();
  const stack = [...(children[rootMemberId] ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    (children[id] ?? []).forEach((c) => stack.push(c));
  }
  return out;
}

/**
 * Membres visibles par `viewer` : sa branche.
 * Le DG (niveau 1) et le propriétaire voient toute l'entreprise.
 */
export function visibleMembers(members: MemberRow[], viewer: MemberRow): MemberRow[] {
  if (viewer.hierarchy_level === 1 || viewer.role === "owner") {
    return members.filter((m) => m.id !== viewer.id);
  }
  const ids = descendantIds(members, viewer.id);
  return members.filter((m) => ids.has(m.id));
}
