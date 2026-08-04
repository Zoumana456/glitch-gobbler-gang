import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  DailyReportState,
  DirectionKpis,
  HierarchyMember,
  HierarchyOverview,
  TeamComplianceRow,
} from "./reports.types";

/** Organigramme de mon entreprise + état du rapport du jour de chaque membre. */
export const getHierarchy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { date?: string }) =>
    z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<HierarchyOverview | null> => {
    const { getMemberRow, listMembers, nameMap } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) return null;

    const members = await listMembers(me.company_id);
    const [{ data: company }, names] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name, owner_id").eq("id", me.company_id).maybeSingle(),
      nameMap(members.map((m) => m.user_id)),
    ]);

    const day = data?.date ?? new Date().toISOString().slice(0, 10);
    const userIds = members.map((m) => m.user_id);
    const [{ data: todayReports }, { data: allReports }] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id, author_id, status, created_at")
        .in("author_id", userIds)
        .eq("report_date", day),
      supabaseAdmin.from("reports").select("author_id").in("author_id", userIds),
    ]);

    const todayMap: Record<string, { id: string; status: DailyReportState }> = {};
    (todayReports ?? []).forEach((r: any) => {
      const existing = todayMap[r.author_id];
      if (!existing || r.created_at > (existing as any).created_at) {
        todayMap[r.author_id] = { id: r.id, status: r.status as DailyReportState };
      }
    });
    const counts: Record<string, number> = {};
    (allReports ?? []).forEach((r: any) => {
      counts[r.author_id] = (counts[r.author_id] ?? 0) + 1;
    });

    const rows: HierarchyMember[] = members.map((m) => ({
      member_id: m.id,
      user_id: m.user_id,
      full_name: names[m.user_id] ?? "Utilisateur",
      position_title: m.position_title ?? "",
      department: m.department ?? "",
      hierarchy_level: m.hierarchy_level,
      manager_id: m.manager_id,
      role: m.role,
      today_state: todayMap[m.user_id]?.status ?? "none",
      today_report_id: todayMap[m.user_id]?.id ?? null,
      reports_count: counts[m.user_id] ?? 0,
    }));

    return {
      company_id: me.company_id,
      company_name: company?.name ?? "",
      is_owner: company?.owner_id === context.userId,
      my_member_id: me.id,
      my_level: me.hierarchy_level,
      members: rows,
    };
  });

/** Met à jour le niveau, le poste, le département ou le rattachement d'un membre. */
export const updateMemberHierarchy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      memberId: string;
      hierarchyLevel?: number;
      positionTitle?: string | null;
      department?: string | null;
      managerId?: string | null;
    }) =>
      z
        .object({
          memberId: z.string().uuid(),
          hierarchyLevel: z.number().int().min(1).max(4).optional(),
          positionTitle: z.string().max(120).nullable().optional(),
          department: z.string().max(120).nullable().optional(),
          managerId: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getMemberRow, listMembers, descendantIds } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) throw new Error("Vous n'appartenez à aucune entreprise.");
    const members = await listMembers(me.company_id);
    const target = members.find((m) => m.id === data.memberId);
    if (!target) throw new Error("Membre introuvable dans votre entreprise.");

    const isDg = me.hierarchy_level === 1 || me.role === "owner";
    const myBranch = descendantIds(members, me.id);
    if (!isDg && !myBranch.has(target.id)) {
      throw new Error("Vous ne pouvez modifier que les membres de votre équipe.");
    }
    if (target.role === "owner" && !isDg) {
      throw new Error("Le dirigeant ne peut pas être modifié.");
    }

    const patch: Record<string, unknown> = {};
    if (data.hierarchyLevel !== undefined) {
      if (!isDg) throw new Error("Seule la direction générale peut changer les niveaux.");
      if (target.role === "owner" && data.hierarchyLevel !== 1) {
        throw new Error("Le dirigeant reste au niveau Direction générale.");
      }
      patch.hierarchy_level = data.hierarchyLevel;
    }
    if (data.positionTitle !== undefined) patch.position_title = data.positionTitle || null;
    if (data.department !== undefined) patch.department = data.department || null;
    if (data.managerId !== undefined) {
      if (data.managerId === null) {
        patch.manager_id = null;
      } else {
        const mgr = members.find((m) => m.id === data.managerId);
        if (!mgr) throw new Error("Supérieur introuvable.");
        if (!isDg && mgr.id !== me.id && !myBranch.has(mgr.id)) {
          throw new Error("Vous ne pouvez rattacher qu'à vous-même ou à votre équipe.");
        }
        patch.manager_id = mgr.id;
      }
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin
      .from("company_members")
      .update(patch)
      .eq("id", target.id)
      .eq("company_id", me.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Suivi de remise des rapports pour toute ma branche. */
export const getTeamCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { date?: string }) =>
    z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamComplianceRow[]> => {
    const { getMemberRow, listMembers, nameMap, visibleMembers } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) return [];
    const members = await listMembers(me.company_id);
    const team = visibleMembers(members, me);
    if (team.length === 0) return [];

    const ids = team.map((m) => m.user_id);
    const day = data?.date ?? new Date().toISOString().slice(0, 10);
    const [names, { data: todayReports }, { data: lastReports }] = await Promise.all([
      nameMap(ids),
      supabaseAdmin
        .from("reports")
        .select("id, author_id, status")
        .in("author_id", ids)
        .eq("report_date", day),
      supabaseAdmin
        .from("reports")
        .select("author_id, created_at")
        .in("author_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    const todayMap: Record<string, DailyReportState> = {};
    (todayReports ?? []).forEach((r: any) => {
      todayMap[r.author_id] = r.status as DailyReportState;
    });
    const lastMap: Record<string, string> = {};
    (lastReports ?? []).forEach((r: any) => {
      if (!lastMap[r.author_id]) lastMap[r.author_id] = r.created_at;
    });

    const nowMs = Date.now();
    return team
      .map((m) => {
        const last = lastMap[m.user_id] ?? null;
        return {
          user_id: m.user_id,
          full_name: names[m.user_id] ?? "Utilisateur",
          position_title: m.position_title ?? "",
          hierarchy_level: m.hierarchy_level,
          department: m.department ?? "",
          today_state: todayMap[m.user_id] ?? "none",
          last_report_at: last,
          days_since_last_report:
            last === null ? null : Math.floor((nowMs - new Date(last).getTime()) / 86400000),
        };
      })
      .sort((a, b) => a.hierarchy_level - b.hierarchy_level || a.full_name.localeCompare(b.full_name));
  });

/** KPIs consolidés pour la direction, par département et par niveau. */
export const getDirectionKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { from?: string; to?: string }) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DirectionKpis | null> => {
    const { getMemberRow, listMembers, visibleMembers } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) return null;
    if (me.hierarchy_level > 2 && me.role !== "owner") {
      throw new Error("Vue réservée à la direction.");
    }
    const members = await listMembers(me.company_id);
    const scope = [...visibleMembers(members, me), me];

    const to = data?.to ?? new Date().toISOString().slice(0, 10);
    const from =
      data?.from ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

    const ids = scope.map((m) => m.user_id);
    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("author_id, status, report_date, submitted_at, approved_at")
      .in("author_id", ids)
      .gte("report_date", from)
      .lte("report_date", to);
    const rows = reports ?? [];

    const workingDays = countWorkingDays(from, to);
    const expected = workingDays * scope.length;
    const submitted = rows.filter((r: any) => r.status !== "draft").length;
    const approved = rows.filter((r: any) => r.status === "approved").length;
    const pending = rows.filter((r: any) => r.status === "submitted" || r.status === "in_review").length;
    const rejected = rows.filter((r: any) => r.status === "rejected").length;

    const delays = rows
      .filter((r: any) => r.submitted_at && r.approved_at)
      .map((r: any) => (new Date(r.approved_at).getTime() - new Date(r.submitted_at).getTime()) / 3600000)
      .filter((h: number) => h >= 0);

    const byMember = Object.fromEntries(scope.map((m) => [m.user_id, m]));
    const deptAgg: Record<string, { head: Set<string>; submitted: number; approved: number; pending: number }> = {};
    const levelAgg: Record<number, { head: Set<string>; submitted: number; approved: number }> = {};
    scope.forEach((m) => {
      const dept = m.department || "Non affecté";
      (deptAgg[dept] ??= { head: new Set(), submitted: 0, approved: 0, pending: 0 }).head.add(m.user_id);
      (levelAgg[m.hierarchy_level] ??= { head: new Set(), submitted: 0, approved: 0 }).head.add(m.user_id);
    });
    rows.forEach((r: any) => {
      const m = byMember[r.author_id];
      if (!m) return;
      const dept = m.department || "Non affecté";
      const d = deptAgg[dept];
      const l = levelAgg[m.hierarchy_level];
      if (r.status !== "draft") {
        if (d) d.submitted += 1;
        if (l) l.submitted += 1;
      }
      if (r.status === "approved") {
        if (d) d.approved += 1;
        if (l) l.approved += 1;
      }
      if (d && (r.status === "submitted" || r.status === "in_review")) d.pending += 1;
    });

    return {
      from,
      to,
      head_count: scope.length,
      expected,
      submitted,
      approved,
      pending,
      rejected,
      compliance_rate: expected > 0 ? Math.round((submitted / expected) * 100) : 0,
      avg_approval_hours:
        delays.length > 0
          ? Math.round((delays.reduce((a: number, b: number) => a + b, 0) / delays.length) * 10) / 10
          : null,
      by_department: Object.entries(deptAgg).map(([department, v]) => {
        const exp = workingDays * v.head.size;
        return {
          department,
          head_count: v.head.size,
          submitted: v.submitted,
          approved: v.approved,
          pending: v.pending,
          compliance_rate: exp > 0 ? Math.round((v.submitted / exp) * 100) : 0,
        };
      }),
      by_level: Object.entries(levelAgg).map(([level, v]) => ({
        level: Number(level),
        head_count: v.head.size,
        submitted: v.submitted,
        approved: v.approved,
      })),
    };
  });

function countWorkingDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let count = 0;
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return Math.max(count, 1);
}
