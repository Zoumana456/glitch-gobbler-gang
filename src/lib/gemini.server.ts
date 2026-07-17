// Server-only Google Gemini helper. Only import from *.functions.ts handlers
// (via top-level static import is fine because filename ends with .server.ts,
// so the bundler blocks it from client bundles).

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiMessage = { role: "user" | "model"; parts: Part[] };

export type GeminiCallOpts = {
  model?: string;
  system?: string;
  contents: GeminiMessage[];
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
};

export async function callGemini(opts: GeminiCallOpts): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Clé API Gemini manquante côté serveur");

  const model = opts.model ?? "gemini-flash-latest";
  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
    },
  };
  if (opts.system) {
    body.systemInstruction = { role: "system", parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("Limite de requêtes IA atteinte. Réessayez dans un instant.");
    if (res.status === 402 || res.status === 403)
      throw new Error("Accès Gemini refusé (quota ou clé). Vérifiez votre clé API.");
    throw new Error(`Gemini a échoué (${res.status}) ${txt.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text;
}

export function parseJsonLoose<T>(text: string): T {
  // strip markdown fences
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    // extract from first { to last }
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first < 0 || last <= first) throw new Error("Réponse IA invalide (JSON introuvable)");
    return JSON.parse(s.slice(first, last + 1)) as T;
  }
}
