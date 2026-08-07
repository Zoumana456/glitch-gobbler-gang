import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MemberRow } from "./hierarchy-tree";

export type { MemberRow } from "./hierarchy-tree";
export {
  findTopMember,
  nextApproverOf,
  descendantIds,
  visibleMembers,
  isShareLinkUsable,
} from "./hierarchy-tree";


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

