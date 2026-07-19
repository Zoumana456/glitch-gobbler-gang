import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_TEXT_LEN = 4000;

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/ai/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonError(401, "Authentification requise");
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token || token.split(".").length !== 3) {
          return jsonError(401, "Jeton invalide");
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return jsonError(500, "Configuration backend manquante");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        const { data: claimsData, error: claimsError } =
          await supabase.auth.getClaims(token);
        if (claimsError || !claimsData?.claims?.sub) {
          return jsonError(401, "Session invalide ou expirée");
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return jsonError(500, "Configuration IA manquante");
        }

        let body: { text?: string; voice?: string };
        try {
          body = (await request.json()) as { text?: string; voice?: string };
        } catch {
          return jsonError(400, "Corps JSON invalide");
        }
        const rawText = (body.text ?? "").trim();
        if (!rawText) return jsonError(400, "Texte manquant");
        // Strip markdown noise so the model doesn't literally read "asterisk" etc.
        const cleaned = rawText
          .replace(/```[\s\S]*?```/g, "")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/[*_#>]+/g, " ")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_TEXT_LEN);
        if (!cleaned) return jsonError(400, "Texte vide après nettoyage");

        const voice = (body.voice ?? "alloy").toString();

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/speech",
          {
            method: "POST",
            headers: {
              "Lovable-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: cleaned,
              voice,
              response_format: "mp3",
            }),
          },
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return new Response(
            JSON.stringify({
              error:
                res.status === 402
                  ? "Crédits IA épuisés. Ajoutez des crédits pour continuer."
                  : res.status === 429
                    ? "Limite de requêtes IA atteinte. Réessayez dans un instant."
                    : `Synthèse vocale impossible (${res.status})`,
              detail: text.slice(0, 300),
            }),
            {
              status: res.status,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
