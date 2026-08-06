import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HIERARCHY_LEVELS, type RoleAudit, type RoleAuditScopeRow } from "./reports.types";

const POLICIES = [
  {
    table: "reports",
    policy: "reports_select_hierarchy",
    rule: "auth.uid() = author_id OR app_private.is_manager_of(auth.uid(), author_id)",
    applies_to: "Lecture des rapports (soi-même + branche descendante)",
  },
  {
    table: "reports",
    policy: "reports_update_current_approver",
    rule: "current_approver_id = auth.uid() AND app_private.is_manager_of(auth.uid(), author_id)",
    applies_to: "Validation / rejet par le valideur en cours",
  },
  {
    table: "reports",
    policy: "reports_delete_own",
    rule: "auth.uid() = author_id",
    applies_to: "Suppression réservée à l'auteur",
  },
  {
    table: "report_approvals",
    policy: "report_approvals_select_hierarchy",
    rule: "auteur du rapport OU app_private.is_manager_of(auth.uid(), author_id)",
    applies_to: "Lecture du journal de validation",
  },
  {
    table: "company_members",
    policy: "company_members_select_same_company",
    rule: "même company_id que le membre connecté",
    applies_to: "Lecture de l'organigramme",
  },
] as const;

/**
 * Audit du mapping rôles ↔ politiques Supabase.
 * Compare la portée attendue par l'application (visibleMembers) avec ce que
 * la base laisse réellement lire via `app_private.is_manager_of`.
 */
export const getRoleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleAudit | null> => {
    const { getMemberRow, listMembers, nameMap, visibleMembers } = await import(
      "./hierarchy.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) return null;

    const members = await listMembers(me.company_id);
    const [{ data: company }, names] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, owner_id")
        .eq("id", me.company_id)
        .maybeSingle(),
      nameMap(members.map((m) => m.user_id)),
    ]);

    const expected = new Set(visibleMembers(members, me).map((m) => m.id));
    expected.add(me.id);

    // Lecture réelle sous RLS, en tant qu'utilisateur connecté.
    const { data: visibleReports } = await context.supabase
      .from("reports")
      .select("author_id");
    const seen: Record<string, number> = {};
    (visibleReports ?? []).forEach((r: any) => {
      seen[r.author_id] = (seen[r.author_id] ?? 0) + 1;
    });

    const scope: RoleAuditScopeRow[] = members
      .map((m) => {
        const exp = expected.has(m.id);
        const count = seen[m.user_id] ?? 0;
        let observed: RoleAuditScopeRow["observed"];
        if (count > 0) observed = exp ? "ok" : "mismatch";
        else observed = exp ? "no_data" : "ok";
        return {
          member_id: m.id,
          user_id: m.user_id,
          full_name: names[m.user_id] ?? "Utilisateur",
          hierarchy_level: m.hierarchy_level,
          role: m.role,
          position_title: m.position_title ?? "",
          department: m.department ?? "",
          expected_visible: exp,
          observed,
          reports_seen: count,
        };
      })
      .sort(
        (a, b) =>
          a.hierarchy_level - b.hierarchy_level || a.full_name.localeCompare(b.full_name),
      );

    const isOwner = company?.owner_id === context.userId;
    const isTop = me.hierarchy_level === 1 || isOwner;
    const hasTeam = expected.size > 1;

    return {
      company_id: me.company_id,
      company_name: company?.name ?? "",
      is_owner: isOwner,
      my_level: me.hierarchy_level,
      my_role: me.role,
      my_role_label:
        HIERARCHY_LEVELS.find((l) => l.level === me.hierarchy_level)?.label ?? "Employé",
      my_position: me.position_title ?? "",
      permissions: {
        view_own: true,
        view_team: hasTeam,
        view_company: isTop,
        validate: hasTeam,
        delete_own: true,
        delete_others: false,
        manage_hierarchy: isTop || hasTeam,
        direction_kpis: me.hierarchy_level <= 2 || isOwner,
      },
      scope,
      policies: POLICIES.map((p) => ({ ...p })),
      mismatches: scope.filter((s) => s.observed === "mismatch").length,
    };
  });
