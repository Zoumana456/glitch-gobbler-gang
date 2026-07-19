import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SharePermission = "view" | "edit";

export type ReportShareRow = {
  id: string;
  report_id: string;
  shared_by: string;
  shared_with: string;
  permission: SharePermission;
  created_at: string;
  target_name: string;
  target_email: string;
};

export type ShareTarget = {
  user_id: string;
  full_name: string;
  email: string;
  kind: "dg" | "employee" | "colleague";
};

export type SharedReportListItem = {
  id: string;
  title: string;
  report_date: string;
  author_id: string;
  author_name: string;
  permission: SharePermission;
  shared_at: string;
};

async function fetchProfileMap(supabase: any, ids: string[]) {
  if (ids.length === 0) return { names: {} as Record<string, string>, emails: {} as Record<string, string> };
  const [{ data: profs }, { data: emails }] = await Promise.all([
    supabase.from("profiles_public").select("id, full_name").in("id", ids),
    supabase.from("profiles").select("id, email").in("id", ids),
  ]);
  return {
    names: Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || ""])),
    emails: Object.fromEntries((emails ?? []).map((p: any) => [p.id, p.email || ""])),
  };
}

export const listShareTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ShareTarget[]> => {
    const { supabase, userId } = context;
    // My company (as employee or owner)
    const { data: mem } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) return [];
    const { data: rows } = await supabase
      .from("company_members")
      .select("user_id, role")
      .eq("company_id", mem.company_id);
    const otherIds = (rows ?? [])
      .map((r: any) => r.user_id)
      .filter((id: string) => id !== userId);
    // Exclude those already shared with for this report
    const { data: existing } = await supabase
      .from("report_shares")
      .select("shared_with")
      .eq("report_id", data.reportId);
    const alreadyShared = new Set((existing ?? []).map((r: any) => r.shared_with));
    const candidateIds = otherIds.filter((id: string) => !alreadyShared.has(id));
    const { names, emails } = await fetchProfileMap(supabase, candidateIds);
    return candidateIds.map((id: string) => {
      const row = (rows ?? []).find((r: any) => r.user_id === id);
      const kind: ShareTarget["kind"] = row?.role === "owner" ? "dg" : mem.role === "owner" ? "employee" : "colleague";
      return {
        user_id: id,
        full_name: names[id] || "Utilisateur",
        email: emails[id] || "",
        kind,
      };
    });
  });

export const listSharesForReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReportShareRow[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("report_shares")
      .select("*")
      .eq("report_id", data.reportId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.shared_with)));
    const { names, emails } = await fetchProfileMap(supabase, ids);
    return (rows ?? []).map((r: any) => ({
      ...r,
      target_name: names[r.shared_with] || "Utilisateur",
      target_email: emails[r.shared_with] || "",
    }));
  });

export const shareReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        targetUserId: z.string().uuid(),
        permission: z.enum(["view", "edit"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("report_shares")
      .upsert(
        {
          report_id: data.reportId,
          shared_by: userId,
          shared_with: data.targetUserId,
          permission: data.permission,
        },
        { onConflict: "report_id,shared_with" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSharePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        permission: z.enum(["view", "edit"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_shares")
      .update({ permission: data.permission })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_shares")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyShareForReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ permission: SharePermission; shared_by: string; sharer_name: string } | null> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("report_shares")
      .select("permission, shared_by")
      .eq("report_id", data.reportId)
      .eq("shared_with", userId)
      .maybeSingle();
    if (!row) return null;
    const { data: prof } = await supabase
      .from("profiles_public")
      .select("full_name")
      .eq("id", row.shared_by)
      .maybeSingle();
    return {
      permission: row.permission as SharePermission,
      shared_by: row.shared_by,
      sharer_name: prof?.full_name || "Utilisateur",
    };
  });

export const listSharedWithMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharedReportListItem[]> => {
    const { supabase, userId } = context;
    const { data: shares } = await supabase
      .from("report_shares")
      .select("id, report_id, permission, created_at, shared_by")
      .eq("shared_with", userId)
      .order("created_at", { ascending: false });
    const rows = shares ?? [];
    if (rows.length === 0) return [];
    const reportIds = rows.map((s: any) => s.report_id);
    const { data: reports } = await supabase
      .from("reports")
      .select("id, title, report_date, author_id")
      .in("id", reportIds);
    const authorIds = Array.from(new Set((reports ?? []).map((r: any) => r.author_id)));
    const { names } = await fetchProfileMap(supabase, authorIds);
    const reportMap = Object.fromEntries((reports ?? []).map((r: any) => [r.id, r]));
    return rows
      .filter((s: any) => reportMap[s.report_id])
      .map((s: any) => {
        const r = reportMap[s.report_id];
        return {
          id: r.id,
          title: r.title,
          report_date: r.report_date,
          author_id: r.author_id,
          author_name: names[r.author_id] || "Utilisateur",
          permission: s.permission as SharePermission,
          shared_at: s.created_at,
        };
      });
  });
