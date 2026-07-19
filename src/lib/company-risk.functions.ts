import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI, parseJsonLoose } from "@/lib/ai-gateway.server";

export type RiskLevel = "none" | "low" | "medium" | "high";
export type CompanyNameRisk = {
  slug: string;
  risk_level: RiskLevel;
  matched_entity: string | null;
  evidence: string | null;
};

export function toCompanySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const CACHE_TTL_DAYS = 30;

/**
 * Server-only helper (no middleware). Safe to call from other server fn handlers.
 */
export async function computeCompanyNameRisk(rawName: string): Promise<CompanyNameRisk> {
  const name = rawName.trim();
  const slug = toCompanySlug(name);
  if (!slug || slug.length < 2) {
    return { slug, risk_level: "none", matched_entity: null, evidence: null };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Cache lookup
  const { data: cached } = await supabaseAdmin
    .from("company_name_risk_cache")
    .select("slug, risk_level, matched_entity, evidence, checked_at")
    .eq("slug", slug)
    .maybeSingle();

  if (cached) {
    const ageDays =
      (Date.now() - new Date(cached.checked_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < CACHE_TTL_DAYS) {
      return {
        slug,
        risk_level: cached.risk_level as RiskLevel,
        matched_entity: cached.matched_entity,
        evidence: cached.evidence,
      };
    }
  }

  // 2. AI lookup
  let result: CompanyNameRisk = {
    slug,
    risk_level: "none",
    matched_entity: null,
    evidence: null,
  };

  try {
    const raw = await callAI({
      system:
        "Tu es un vérificateur d'identité d'entreprise pour un service au public en Côte d'Ivoire. " +
        "Ton rôle : évaluer si un nom saisi lors de la création d'un compte entreprise correspond à une " +
        "société, marque, banque, opérateur télécom, institution, ONG ou administration reconnue en Côte d'Ivoire " +
        "(exemples : Orange CI, MTN CI, Moov Africa, Jumia, SGBCI, NSIA, Ecobank, Petro Ivoire, SIR, CIE, SODECI, " +
        "Bolloré, Nestlé CI, Unilever CI, PMU CI, ministères, universités publiques) ou à une marque internationale " +
        "très connue (Google, Apple, Coca-Cola, etc.). " +
        "Réponds UNIQUEMENT en JSON strict : {\"risk_level\":\"none|low|medium|high\",\"matched_entity\":string|null,\"evidence\":string|null}. " +
        "high = correspondance claire avec une entité existante reconnue ; medium = variante orthographique très proche ; " +
        "low = nom générique qui pourrait prêter à confusion ; none = pas de correspondance identifiable.",
      messages: [
        {
          role: "user",
          content: `Nom saisi : "${name}"\n\nÉvalue le risque d'usurpation.`,
        },
      ],
      json: true,
      temperature: 0.1,
    });

    const parsed = parseJsonLoose<{
      risk_level?: string;
      matched_entity?: string | null;
      evidence?: string | null;
    }>(raw);

    const lvl = (parsed.risk_level ?? "none").toLowerCase();
    result = {
      slug,
      risk_level: (["none", "low", "medium", "high"].includes(lvl)
        ? lvl
        : "none") as RiskLevel,
      matched_entity: parsed.matched_entity?.toString().slice(0, 200) ?? null,
      evidence: parsed.evidence?.toString().slice(0, 500) ?? null,
    };
  } catch (err) {
    console.error("[computeCompanyNameRisk] AI error:", err);
    return result;
  }

  // 3. Upsert cache
  try {
    await supabaseAdmin.from("company_name_risk_cache").upsert(
      {
        slug,
        original_name: name,
        risk_level: result.risk_level,
        matched_entity: result.matched_entity,
        evidence: result.evidence,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );
  } catch (err) {
    console.error("[computeCompanyNameRisk] cache write error:", err);
  }

  return result;
}

export const checkCompanyNameRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data }): Promise<CompanyNameRisk> => {
    return computeCompanyNameRisk(data.name);
  });
