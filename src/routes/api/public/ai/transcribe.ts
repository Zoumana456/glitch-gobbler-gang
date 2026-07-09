import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/public/ai/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // --- AuthN: require a valid Supabase Bearer token ---
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

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return jsonError(400, "Fichier audio manquant");
        }
        if (file.size > MAX_AUDIO_BYTES) {
          return jsonError(413, "Fichier audio trop volumineux (max 10 Mo)");
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, file.name || "recording.wav");
        upstream.append("language", "fr");

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { "Lovable-API-Key": apiKey },
            body: upstream,
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
                    : `Transcription impossible (${res.status})`,
              detail: text.slice(0, 300),
            }),
            {
              status: res.status,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const json = (await res.json()) as any;
        return new Response(JSON.stringify({ text: json?.text ?? "" }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
