// Server-only Lovable AI Gateway helper.
// Uses LOVABLE_API_KEY (auto-provisioned) — no user-configured key.
// OpenAI-compatible chat completions endpoint.

const BASE = "https://ai.gateway.lovable.dev/v1";

export const DEFAULT_MODEL = "google/gemini-3.5-flash";
export const PRO_MODEL = "google/gemini-3.1-pro-preview";

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type FileContent = {
  type: "file";
  file: { filename: string; file_data: string };
};

export type AIContent = TextContent | ImageContent | FileContent;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | AIContent[];
};

export type AICallOpts = {
  model?: string;
  system?: string;
  messages: AIMessage[];
  json?: boolean;
  temperature?: number;
};

export async function callAI(opts: AICallOpts): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY manquant côté serveur");

  const messages: AIMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push(...opts.messages);

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "custom",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("Limite de requêtes IA atteinte. Réessayez dans un instant.");
    if (res.status === 402)
      throw new Error(
        "Crédits IA épuisés. Ajoutez des crédits dans les paramètres du workspace.",
      );
    throw new Error(`IA a échoué (${res.status}) ${txt.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export function parseJsonLoose<T>(text: string): T {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first < 0 || last <= first) throw new Error("Réponse IA invalide (JSON introuvable)");
    return JSON.parse(s.slice(first, last + 1)) as T;
  }
}
