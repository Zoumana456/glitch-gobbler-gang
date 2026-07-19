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
  ai_check_report: JsonValue | null;
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


const KycInput = z.object({
  name: z.string().min(1).max(200),
  proofPath: z.string().min(1),
  identityPath: z.string().min(1),
  identityType: z.enum(["id_card", "passport", "driving_license"]),
  selfiePath: z.string().min(1),
  fullLegalName: z.string().trim().min(2).max(120),
  message: z.string().max(2000).optional(),
});

export const requestCompanyVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KycInput.parse(d))
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
    const { data: inserted, error } = await supabase
      .from("company_verification_requests")
      .insert({
        user_id: userId,
        requested_name: data.name.trim(),
        slug,
        proof_path: data.proofPath,
        identity_document_path: data.identityPath,
        identity_document_type: data.identityType,
        selfie_path: data.selfiePath,
        full_legal_name: data.fullLegalName,
        message: data.message ?? null,
        ai_check_status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Fire-and-forget AI KYC check (do not block user submission on it)
    if (inserted?.id) {
      runKycAiCheck(inserted.id, {
        name: data.name.trim(),
        proofPath: data.proofPath,
        identityPath: data.identityPath,
        identityType: data.identityType,
        selfiePath: data.selfiePath,
        fullLegalName: data.fullLegalName,
      }).catch((err) => console.error("KYC AI check failed:", err));
    }

    return { ok: true };
  });

async function runKycAiCheck(
  requestId: string,
  d: {
    name: string;
    proofPath: string;
    identityPath: string;
    identityType: string;
    selfiePath: string;
    fullLegalName: string;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function toDataUrl(path: string): Promise<string | null> {
    const { data: file } = await supabaseAdmin.storage.from("company-proofs").download(path);
    if (!file) return null;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  try {
    const [proofUrl, idUrl, selfieUrl] = await Promise.all([
      toDataUrl(d.proofPath),
      toDataUrl(d.identityPath),
      toDataUrl(d.selfiePath),
    ]);

    const system =
      "Tu es un agent de conformité KYC. Analyse les documents et réponds STRICTEMENT en JSON avec les champs: face_match (0-100), name_match (0-100), person_on_business_proof (boolean), documents_readable (boolean), documents_authentic (0-100), issues (string[]), overall ('passed'|'flagged'), summary (string). Sois strict mais factuel.";

    const isImage = (p: string) => /\.(png|jpe?g|webp)$/i.test(p);
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } }
    > = [
      {
        type: "text",
        text: `Entreprise demandée: "${d.name}"\nNom légal déclaré: "${d.fullLegalName}"\nType de pièce d'identité: ${d.identityType}\n\nDocuments joints dans l'ordre: 1) justificatif d'entreprise, 2) pièce d'identité, 3) selfie avec la pièce. Vérifie: le visage du selfie correspond-il à la pièce ? Le nom sur la pièce correspond-il au nom déclaré ? La personne apparaît-elle sur le justificatif d'entreprise ? Documents lisibles/non altérés ?`,
      },
    ];
    if (proofUrl) {
      content.push(
        isImage(d.proofPath)
          ? { type: "image_url", image_url: { url: proofUrl } }
          : { type: "file", file: { filename: "proof", file_data: proofUrl } },
      );
    }
    if (idUrl) content.push({ type: "image_url", image_url: { url: idUrl } });
    if (selfieUrl) content.push({ type: "image_url", image_url: { url: selfieUrl } });

    const raw = await callAI({
      system,
      messages: [{ role: "user", content }],
      json: true,
      temperature: 0.1,
    });
    const report = parseJsonLoose<Record<string, unknown>>(raw);
    const status =
      typeof report.overall === "string" && report.overall === "passed" ? "passed" : "flagged";
    await supabaseAdmin
      .from("company_verification_requests")
      .update({ ai_check_status: status, ai_check_report: report as unknown as JsonValue })
      .eq("id", requestId);
  } catch (err: any) {
    await supabaseAdmin
      .from("company_verification_requests")
      .update({
        ai_check_status: "flagged",
        ai_check_report: { error: String(err?.message ?? err) } as unknown as JsonValue,
      })
      .eq("id", requestId);
  }
}



export const listMyVerificationRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyVerificationRequest[]> => {
    const { data } = await context.supabase
      .from("company_verification_requests")
      .select(
        "id, requested_name, slug, status, proof_path, identity_document_path, identity_document_type, selfie_path, full_legal_name, ai_check_status, ai_check_report, message, admin_note, created_at, reviewed_at",
      )
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as MyVerificationRequest[];
  });

// ============= Admin operations =============

export const listReservedNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReservedName[]> => {
    if (!(await isPlatformAdmin(context.userId))) throw new Error("Réservé aux super admins");
    if ((context.claims as any)?.aal !== "aal2") throw new Error("2FA requise (super admin doit valider un code TOTP)");
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
    if ((context.claims as any)?.aal !== "aal2") throw new Error("2FA requise (super admin doit valider un code TOTP)");
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
    if ((context.claims as any)?.aal !== "aal2") throw new Error("2FA requise (super admin doit valider un code TOTP)");
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
    if ((context.claims as any)?.aal !== "aal2") throw new Error("2FA requise (super admin doit valider un code TOTP)");
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
    async function sign(path: string | null): Promise<string | null> {
      if (!path) return null;
      const { data: signed } = await supabaseAdmin.storage
        .from("company-proofs")
        .createSignedUrl(path, 5 * 60);
      return signed?.signedUrl ?? null;
    }
    for (const r of rows as any[]) {
      const [proofUrl, identityUrl, selfieUrl] = await Promise.all([
        sign(r.proof_path),
        sign(r.identity_document_path),
        sign(r.selfie_path),
      ]);
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
        identity_document_path: r.identity_document_path ?? null,
        identity_document_type: r.identity_document_type ?? null,
        identity_document_url: identityUrl,
        selfie_path: r.selfie_path ?? null,
        selfie_url: selfieUrl,
        full_legal_name: r.full_legal_name ?? null,
        ai_check_status: r.ai_check_status ?? null,
        ai_check_report: (r.ai_check_report ?? null) as JsonValue | null,
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
    if ((context.claims as any)?.aal !== "aal2") throw new Error("2FA requise (super admin doit valider un code TOTP)");
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
