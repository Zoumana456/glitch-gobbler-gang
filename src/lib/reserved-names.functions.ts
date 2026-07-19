import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI, parseJsonLoose } from "@/lib/ai-gateway.server";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };


function normalize(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export type ReservedName = {
  id: string;
  slug: string;
  display_name: string;
  notes: string | null;
  created_at: string;
};

export type MyVerificationRequest = {
  id: string;
  requested_name: string;
  slug: string;
  status: "pending" | "approved" | "rejected";
  proof_path: string | null;
  identity_document_path: string | null;
  identity_document_type: string | null;
  selfie_path: string | null;
  full_legal_name: string | null;
  ai_check_status: string | null;
  ai_check_report: Record<string, unknown> | null;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminVerificationRequest = MyVerificationRequest & {
  user_id: string;
  user_email: string;
  user_name: string;
  proof_url: string | null;
  identity_document_url: string | null;
  selfie_url: string | null;
};

async function isPlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export const checkNameReservedPublic = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const slug = normalize(data.name);
    if (!slug) return { reserved: false, displayName: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("reserved_company_names")
      .select("slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    return { reserved: !!row, displayName: row?.display_name ?? null };
  });

export const checkNameReserved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const slug = normalize(data.name);
    if (!slug) return { reserved: false, alreadyApproved: false, displayName: null as string | null };
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("reserved_company_names")
      .select("slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (!row) return { reserved: false, alreadyApproved: false, displayName: null };
    const { data: approved } = await supabase
      .from("company_verification_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .eq("status", "approved")
      .maybeSingle();
    return { reserved: true, alreadyApproved: !!approved, displayName: row.display_name };
  });


export const requestCompanyVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; proofPath: string; message?: string }) =>
    z
      .object({
        name: z.string().min(1).max(200),
        proofPath: z.string().min(1),
        message: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const slug = normalize(data.name);
    if (!slug) throw new Error("Nom invalide");
    const { supabase, userId } = context;
    const { data: pending } = await supabase
      .from("company_verification_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    if (pending) throw new Error("Une demande existe déjà pour ce nom");
    const { error } = await supabase.from("company_verification_requests").insert({
      user_id: userId,
      requested_name: data.name.trim(),
      slug,
      proof_path: data.proofPath,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyVerificationRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyVerificationRequest[]> => {
    const { data } = await context.supabase
      .from("company_verification_requests")
      .select("id, requested_name, slug, status, proof_path, message, admin_note, created_at, reviewed_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as MyVerificationRequest[];
  });

// ============= Admin operations =============

export const listReservedNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReservedName[]> => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reserved_company_names")
      .select("id, slug, display_name, notes, created_at")
      .order("display_name", { ascending: true });
    return (data ?? []) as ReservedName[];
  });

export const addReservedName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; notes?: string }) =>
    z.object({ name: z.string().min(1).max(120), notes: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    const slug = normalize(data.name);
    if (!slug) throw new Error("Nom invalide");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reserved_company_names").insert({
      slug,
      display_name: data.name.trim(),
      notes: data.notes ?? null,
      created_by: context.userId,
    });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const removeReservedName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reserved_company_names")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVerificationRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminVerificationRequest[]> => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("company_verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!rows?.length) return [];
    const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    const out: AdminVerificationRequest[] = [];
    for (const r of rows as any[]) {
      let proofUrl: string | null = null;
      if (r.proof_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("company-proofs")
          .createSignedUrl(r.proof_path, 5 * 60); // 5 min
        proofUrl = signed?.signedUrl ?? null;
      }
      out.push({
        id: r.id,
        user_id: r.user_id,
        user_email: profMap[r.user_id]?.email ?? "",
        user_name: profMap[r.user_id]?.full_name ?? "",
        requested_name: r.requested_name,
        slug: r.slug,
        status: r.status,
        proof_path: r.proof_path,
        proof_url: proofUrl,
        message: r.message,
        admin_note: r.admin_note,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
      });
    }
    return out;
  });

export const reviewVerificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("company_verification_requests")
      .update({
        status: data.approve ? "approved" : "rejected",
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
