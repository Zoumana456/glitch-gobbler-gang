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

function toSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const CACHE_TTL_DAYS = 30;

export const checkCompanyNameRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CompanyNameRisk> => {
    const name = data.name.trim();
    const slug = toSlug(name);
    if (!slug || slug.length < 2) {
      return { slug, risk_level: "none", matched_entity: null, evidence: null };
    }

    // 1. Cache lookup (via authenticated client, RLS grants SELECT to authenticated)
    const { supabase } = context;
    const { data: cached } = await supabase
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

    // 2. IA lookup
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
          "Ton rôle est d'évaluer si un nom saisi lors de la création d'un compte entreprise correspond à une " +
          "société, marque, banque, opérateur télécom, institution, ONG ou administration reconnue en Côte d'Ivoire " +
          "(par exemple : Orange CI, MTN CI, Moov Africa, Jumia, SGBCI, NSIA, Ecobank, Petro Ivoire, SIR, CIE, SODECI, " +
          "Bolloré, Nestlé CI, Unilever CI, PMU CI, ministères, universités publiques). " +
          "Réponds UNIQUEMENT en JSON strict avec les clés : risk_level (none|low|medium|high), matched_entity (string|null), evidence (string|null). " +
          "high = correspond clairement à une entité reconnue existante ; medium = ressemblance forte / variante orthographique ; " +
          "low = nom courant qui pourrait prêter à confusion ; none = pas de correspondance.",
        messages: [
          {
            role: "user",
            content: `Nom saisi : "${name}"\n\nÉvalue le risque d'usurpation d'identité.`,
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
        risk_level: (["none", "low", "medium", "high"].includes(lvl) ? lvl : "none") as RiskLevel,
        matched_entity: parsed.matched_entity?.toString().slice(0, 200) ?? null,
        evidence: parsed.evidence?.toString().slice(0, 500) ?? null,
      };
    } catch (err) {
      // Fallback silencieux : en cas d'erreur IA, on ne bloque pas.
      console.error("[checkCompanyNameRisk] AI error:", err);
      return result;
    }

    // 3. Upsert cache (via service role)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("company_name_risk_cache")
        .upsert(
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
      console.error("[checkCompanyNameRisk] cache write error:", err);
    }

    return result;
  });
