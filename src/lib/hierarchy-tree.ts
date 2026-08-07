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

/** Un lien de partage est-il encore exploitable ? */
export function isShareLinkUsable(
  share: { share_token: string | null; share_expires_at: string | null } | null,
  now: Date = new Date(),
): boolean {
  if (!share || !share.share_token) return false;
  if (!share.share_expires_at) return true;
  const exp = new Date(share.share_expires_at).getTime();
  if (Number.isNaN(exp)) return false;
  return exp > now.getTime();
}
