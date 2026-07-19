import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

function hasAal2(claims: any): boolean {
  return claims?.aal === "aal2";
}

async function assertPlatformAdmin(_supabase: any, userId: string, claims?: any) {
  if (!(await isPlatformAdmin(userId))) throw new Error("Réservé aux super admins");
  if (claims !== undefined && !hasAal2(claims)) {
    throw new Error("2FA requise (super admin doit valider un code TOTP)");
  }
}

export const checkIsPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    return isPlatformAdmin(context.userId);
  });

export type AdminAccessStatus = {
  isAdmin: boolean;
  aal: string | null;
  mfaVerified: boolean;
};

export const getAdminAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccessStatus> => {
    const isAdmin = await isPlatformAdmin(context.userId);
    const aal = (context.claims as any)?.aal ?? null;
    return { isAdmin, aal, mfaVerified: aal === "aal2" };
  });


export type AdminCompanyRow = {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  seat_limit: number;
  members_count: number;
  created_at: string;
};

export const listCompaniesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCompanyRow[]> => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, name, owner_id, seat_limit, created_at")
      .order("created_at", { ascending: false });
    if (!companies || companies.length === 0) return [];
    const ownerIds = companies.map((c: any) => c.owner_id);
    const [{ data: profs }, { data: counts }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ownerIds),
      supabaseAdmin
        .from("company_members")
        .select("company_id")
        .in("company_id", companies.map((c: any) => c.id)),
    ]);
    const profMap = Object.fromEntries(
      (profs ?? []).map((p: any) => [p.id, p]),
    );
    const countMap: Record<string, number> = {};
    (counts ?? []).forEach((r: any) => {
      countMap[r.company_id] = (countMap[r.company_id] ?? 0) + 1;
    });
    return companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      owner_id: c.owner_id,
      owner_email: profMap[c.owner_id]?.email ?? "",
      owner_name: profMap[c.owner_id]?.full_name ?? "",
      seat_limit: c.seat_limit,
      members_count: countMap[c.id] ?? 0,
      created_at: c.created_at,
    }));
  });

export const updateSeatLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; seatLimit: number }) =>
    z
      .object({
        companyId: z.string().uuid(),
        seatLimit: z.number().int().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ seat_limit: data.seatLimit })
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PlatformAdminRow = {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
};

export const listPlatformAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAdminRow[]> => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id, created_at")
      .order("created_at", { ascending: true });
    if (!rows || rows.length === 0) return [];
    const ids = rows.map((r: any) => r.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    return rows.map((r: any) => ({
      user_id: r.user_id,
      email: profMap[r.user_id]?.email ?? "",
      full_name: profMap[r.user_id]?.full_name ?? "",
      created_at: r.created_at,
    }));
  });

export const addPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!prof) throw new Error("Aucun utilisateur avec cet email");
    const { error } = await supabaseAdmin
      .from("platform_admins")
      .insert({ user_id: prof.id });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const removePlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    if (data.userId === context.userId)
      throw new Error("Vous ne pouvez pas vous retirer vous-même");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) throw new Error("Impossible de retirer le dernier super admin");
    const { error } = await supabaseAdmin
      .from("platform_admins")
      .delete()
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
