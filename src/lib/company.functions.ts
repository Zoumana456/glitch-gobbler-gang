import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const INACTIVE_THRESHOLD_DAYS = 3;
export const INACTIVE_THRESHOLD_MIN = 3;
export const INACTIVE_THRESHOLD_MAX = 4;

const thresholdInput = z
  .object({
    inactiveThresholdDays: z
      .number()
      .int()
      .min(INACTIVE_THRESHOLD_MIN)
      .max(INACTIVE_THRESHOLD_MAX)
      .optional(),
  })
  .optional();


export type CompanyMember = {
  user_id: string;
  role: "owner" | "employee";
  joined_at: string;
  email: string;
  full_name: string;
  last_report_at: string | null;
  reports_count: number;
  activity_status: "active" | "inactive";
  days_since_last_report: number | null;
};

export type MyCompany = {
  id: string;
  name: string;
  owner_id: string;
  seat_limit: number;
  seats_used: number;
  is_owner: boolean;
  threshold_days: number;
  members: CompanyMember[];
};

export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { inactiveThresholdDays?: number }) => thresholdInput.parse(d))
  .handler(async ({ data, context }): Promise<MyCompany | null> => {
    const thresholdDays = data?.inactiveThresholdDays ?? INACTIVE_THRESHOLD_DAYS;
    const { supabase, userId } = context;

    const { data: mem } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) return null;
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", mem.company_id)
      .maybeSingle();
    if (!company) return null;

    const isOwner = company.owner_id === userId;
    let members: CompanyMember[] = [];
    if (isOwner) {
      const { data: rows } = await supabase
        .from("company_members")
        .select("user_id, role, joined_at")
        .eq("company_id", company.id);
      const ids = (rows ?? []).map((r: any) => r.user_id);
      const [{ data: profs }, { data: reports }] = await Promise.all([
        ids.length
          ? supabase.from("profiles_public").select("id, full_name").in("id", ids)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("reports").select("author_id, created_at").in("author_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || ""]));
      const reportStats: Record<string, { count: number; last: string | null }> = {};
      (reports ?? []).forEach((r: any) => {
        const s = (reportStats[r.author_id] ??= { count: 0, last: null });
        s.count += 1;
        if (!s.last || r.created_at > s.last) s.last = r.created_at;
      });
      // Fetch emails via admin (owner already authorized here — RLS on member_id already grants access via profiles.email? profiles.email is present but SELECT policy may block). Use profiles table directly.
      const { data: emailRows } = ids.length
        ? await supabase.from("profiles").select("id, email").in("id", ids)
        : { data: [] as any[] };
      const emailMap = Object.fromEntries((emailRows ?? []).map((p: any) => [p.id, p.email || ""]));
      const nowMs = Date.now();
      members = (rows ?? []).map((r: any) => {
        const last = reportStats[r.user_id]?.last ?? null;
        const daysSince =
          last === null ? null : Math.floor((nowMs - new Date(last).getTime()) / 86400000);
        const isInactive = daysSince === null || daysSince > thresholdDays;
        return {
          user_id: r.user_id,
          role: r.role,
          joined_at: r.joined_at,
          email: emailMap[r.user_id] ?? "",
          full_name: profMap[r.user_id] ?? "",
          last_report_at: last,
          reports_count: reportStats[r.user_id]?.count ?? 0,
          activity_status: (isInactive ? "inactive" : "active") as "active" | "inactive",
          days_since_last_report: daysSince,
        };
      });
    }

    return {
      id: company.id,
      name: company.name,
      owner_id: company.owner_id,
      seat_limit: company.seat_limit,
      seats_used: isOwner ? members.length : 1,
      is_owner: isOwner,
      threshold_days: thresholdDays,
      members,
    };

  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("Vous appartenez déjà à une entreprise");

    // Reserved-name gate
    const slug = (data.name ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (slug) {
      const { data: reserved } = await supabase
        .from("reserved_company_names")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();
      if (reserved) {
        const { data: approved } = await supabase
          .from("company_verification_requests")
          .select("id")
          .eq("user_id", userId)
          .eq("slug", slug)
          .eq("status", "approved")
          .maybeSingle();
        if (!approved) {
          return {
            id: null,
            needsVerification: true as const,
            reason:
              "Ce nom d'entreprise est protégé. Ouvrez une demande de vérification (KYC) pour l'utiliser.",
          };
        }
      }
    }

    const { data: company, error } = await supabase
      .from("companies")
      .insert({ name: data.name, owner_id: userId })
      .select()
      .single();
    if (error || !company) throw new Error(error?.message ?? "Erreur");
    const { error: e2 } = await supabase.from("company_members").insert({
      company_id: company.id,
      user_id: userId,
      role: "owner",
    });
    if (e2) throw new Error(e2.message);
    return { id: company.id as string, needsVerification: false as const };
  });


export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id, seat_limit")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) throw new Error("Vous n'êtes propriétaire d'aucune entreprise");
    const { count } = await supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", comp.id);
    if ((count ?? 0) >= comp.seat_limit) throw new Error("Quota de sièges atteint");
    const { data: inv, error } = await supabase
      .from("company_invitations")
      .insert({
        company_id: comp.id,
        email: data.email.toLowerCase(),
        invited_by: userId,
      })
      .select("token")
      .single();
    if (error || !inv) throw new Error(error?.message ?? "Erreur");
    return { token: inv.token };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("company_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) return [];
    const { data } = await supabase
      .from("company_invitations")
      .select("id, email, status, expires_at, created_at, token")
      .eq("company_id", comp.id)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("company_invitations")
      .select("*, companies(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation introuvable");
    if (inv.status !== "pending") throw new Error("Invitation déjà utilisée ou révoquée");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitation expirée");

    const { data: existing } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("Vous appartenez déjà à une entreprise");

    // Insert as employee — bypass RLS since the invitation is our authorization
    const { error: eIns } = await supabaseAdmin
      .from("company_members")
      .insert({ company_id: inv.company_id, user_id: userId, role: "employee" });
    if (eIns) throw new Error(eIns.message);
    await supabaseAdmin
      .from("company_invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id);
    return { companyName: (inv as any).companies?.name ?? "" };
  });

export const getInvitationPreview = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("company_invitations")
      .select("id, email, status, expires_at, companies(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return null;
    return {
      email: inv.email,
      status: inv.status,
      expires_at: inv.expires_at,
      company_name: (inv as any).companies?.name ?? "",
    };
  });

export const listCompaniesDirectory = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ id: string; name: string }[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true });
    return (data ?? []) as { id: string; name: string }[];
  });

export const joinCompanyDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("Vous appartenez déjà à une entreprise");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: comp } = await supabaseAdmin
      .from("companies")
      .select("id, name, seat_limit")
      .eq("id", data.companyId)
      .maybeSingle();
    if (!comp) throw new Error("Entreprise introuvable");
    const { count } = await supabaseAdmin
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", comp.id);
    if ((count ?? 0) >= comp.seat_limit) throw new Error("Quota de sièges atteint pour cette entreprise");
    const { error } = await supabaseAdmin
      .from("company_members")
      .insert({ company_id: comp.id, user_id: userId, role: "employee" });
    if (error) throw new Error(error.message);
    return { companyName: comp.name };
  });

export const createEmployeeDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; fullName: string }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id, seat_limit")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) throw new Error("Vous n'êtes propriétaire d'aucune entreprise");
    const { count } = await supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", comp.id);
    if ((count ?? 0) >= comp.seat_limit) throw new Error("Quota de sièges atteint");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Impossible de créer le compte");
    const { error: eIns } = await supabaseAdmin.from("company_members").insert({
      company_id: comp.id,
      user_id: created.user.id,
      role: "employee",
    });
    if (eIns) throw new Error(eIns.message);
    return { userId: created.user.id };
  });

export const removeEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) throw new Error("Non autorisé");
    if (data.userId === userId) throw new Error("Vous ne pouvez pas vous retirer");
    const { error } = await supabase
      .from("company_members")
      .delete()
      .eq("company_id", comp.id)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type EmployeeReport = {
  id: string;
  title: string;
  report_date: string;
  created_at: string;
  intro: string;
};

export const listEmployeeReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employeeId: string }) =>
    z.object({ employeeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ employee: { id: string; name: string; email: string }; reports: EmployeeReport[] }> => {
    const { supabase, userId } = context;
    // verify DG relationship
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) throw new Error("Non autorisé");
    const { data: mem } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", comp.id)
      .eq("user_id", data.employeeId)
      .maybeSingle();
    if (!mem) throw new Error("Cet employé ne fait pas partie de votre entreprise");
    const [{ data: reports }, { data: prof }, { data: profEmail }] = await Promise.all([
      supabase
        .from("reports")
        .select("id, title, report_date, created_at, intro")
        .eq("author_id", data.employeeId)
        .order("report_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles_public").select("id, full_name").eq("id", data.employeeId).maybeSingle(),
      supabase.from("profiles").select("email").eq("id", data.employeeId).maybeSingle(),
    ]);
    return {
      employee: {
        id: data.employeeId,
        name: prof?.full_name ?? "Employé",
        email: profEmail?.email ?? "",
      },
      reports: (reports ?? []) as EmployeeReport[],
    };
  });

export const getCompanyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { inactiveThresholdDays?: number }) => thresholdInput.parse(d))
  .handler(async ({ data, context }) => {
    const thresholdDays = data?.inactiveThresholdDays ?? INACTIVE_THRESHOLD_DAYS;
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) return null;
    const { data: members } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", comp.id);
    const ids = (members ?? []).map((m: any) => m.user_id);
    if (ids.length === 0)
      return { totalMonth: 0, perDay: [], inactive: [], threshold_days: thresholdDays };
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: reports } = await supabase
      .from("reports")
      .select("author_id, report_date, created_at")
      .in("author_id", ids)
      .gte("created_at", since.toISOString());
    const perDayMap: Record<string, number> = {};
    (reports ?? []).forEach((r: any) => {
      perDayMap[r.report_date] = (perDayMap[r.report_date] ?? 0) + 1;
    });
    const perDay = Object.entries(perDayMap)
      .sort()
      .map(([date, count]) => ({ date, count }));

    // Inactive: no report in the last `thresholdDays` days
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - thresholdDays);
    const activeIds = new Set(
      (reports ?? [])
        .filter((r: any) => new Date(r.created_at) >= threshold)
        .map((r: any) => r.author_id),
    );
    const inactive = ids.filter((id) => !activeIds.has(id));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const totalMonth = (reports ?? []).filter((r: any) => r.created_at >= monthStart).length;

    return { totalMonth, perDay, inactive, threshold_days: thresholdDays };

  });

export type DailyStatusRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: "owner" | "employee";
  reports_count: number;
  last_report_at: string | null;
  status: "done" | "missing";
};

export const getCompanyDailyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date: string }) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<DailyStatusRow[]> => {
    const { supabase, userId } = context;
    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!comp) return [];
    const { data: members } = await supabase
      .from("company_members")
      .select("user_id, role")
      .eq("company_id", comp.id);
    const ids = (members ?? []).map((m: any) => m.user_id);
    if (ids.length === 0) return [];
    const [{ data: profs }, { data: emails }, { data: reports }] = await Promise.all([
      supabase.from("profiles_public").select("id, full_name").in("id", ids),
      supabase.from("profiles").select("id, email").in("id", ids),
      supabase
        .from("reports")
        .select("author_id, created_at")
        .in("author_id", ids)
        .eq("report_date", data.date),
    ]);
    const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || ""]));
    const emailMap = Object.fromEntries((emails ?? []).map((p: any) => [p.id, p.email || ""]));
    const stats: Record<string, { count: number; last: string | null }> = {};
    (reports ?? []).forEach((r: any) => {
      const s = (stats[r.author_id] ??= { count: 0, last: null });
      s.count += 1;
      if (!s.last || r.created_at > s.last) s.last = r.created_at;
    });
    return (members ?? []).map((m: any) => {
      const s = stats[m.user_id];
      return {
        user_id: m.user_id,
        full_name: profMap[m.user_id] ?? "",
        email: emailMap[m.user_id] ?? "",
        role: m.role,
        reports_count: s?.count ?? 0,
        last_report_at: s?.last ?? null,
        status: (s?.count ?? 0) > 0 ? "done" : "missing",
      };
    });
  });

