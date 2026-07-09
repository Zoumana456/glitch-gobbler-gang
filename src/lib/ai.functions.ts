import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  pdfBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  filename: z.string().default("document.pdf"),
});

const extractedSchema = z.object({
  title: z.string().default(""),
  intro: z.string().default(""),
  conclusion: z.string().default(""),
  sections: z
    .array(
      z.object({
        title: z.string().default(""),
        description: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type ExtractedReport = z.infer<typeof extractedSchema>;

export const extractReportFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Configuration IA manquante");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant qui analyse des rapports d'activités PDF en français et en extrait la structure. Réponds uniquement avec un JSON strict, sans texte supplémentaire.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extrait la structure de ce rapport d'activités en JSON avec ce schéma exact :\n" +
                '{"title": string, "intro": string, "conclusion": string, "sections": [{"title": string, "description": string, "bullets": [string]}]}\n' +
                "Utilise le français. Ne renvoie rien d'autre que le JSON.",
            },
            {
              type: "file",
              file: {
                filename: data.filename,
                file_data: `data:${data.mimeType};base64,${data.pdfBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requêtes IA atteinte. Réessayez dans un instant.");
      if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits pour continuer.");
      throw new Error(`Extraction IA impossible (${res.status}) ${errText.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Réponse IA invalide");
      parsed = JSON.parse(match[0]);
    }
    return extractedSchema.parse(parsed);
  });
