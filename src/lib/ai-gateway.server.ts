// Server-only AI helper.
// Uses the user's GEMINI_API_KEY first (with model fallback chain), then
// falls back to the Lovable AI Gateway (LOVABLE_API_KEY) if Gemini fails.
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

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

function geminiModel(m?: string): string {
  const name = (m ?? DEFAULT_MODEL).replace(/^google\//, "");
  if (name.includes("pro")) return "gemini-pro-latest";
  return "gemini-flash-latest";
}

function geminiChain(m?: string): string[] {
  const first = geminiModel(m);
  const rest = first.includes("pro")
    ? ["gemini-3.1-pro-preview", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.1-flash-lite"]
    : ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
  return [first, ...rest];
}

async function callGemini(opts: AICallOpts, key: string): Promise<string> {
  const messages: AIMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  for (const m of opts.messages) {
    if (typeof m.content === "string") { messages.push(m); continue; }
    messages.push({
      role: m.role,
      content: m.content.map((c) =>
        c.type === "file"
          ? ({ type: "image_url", image_url: { url: c.file.file_data } } as ImageContent)
          : c,
      ),
    });
  }
  const body: Record<string, unknown> = {
    model: geminiModel(opts.model),
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  let last = "";
  for (const model of geminiChain(opts.model)) {
    body.model = model;
    const res = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return json.choices?.[0]?.message?.content ?? "";
    }
    last = `${res.status} ${(await res.text().catch(() => "")).slice(0, 240)}`;
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  throw new Error(`Gemini a échoué (${last})`);
}

export async function callAI(opts: AICallOpts): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      return await callGemini(opts, geminiKey);
    } catch (e) {
      if (!process.env.LOVABLE_API_KEY) throw e;
      console.error("[ai] Gemini failed, falling back:", (e as Error).message);
    }
  }
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
