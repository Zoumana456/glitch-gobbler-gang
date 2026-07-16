import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini, parseJsonLoose, type GeminiMessage } from "./gemini.server";

// ----- Shared schemas -----

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

const REPORT_JSON_SHAPE =
  '{"title": string, "intro": string, "conclusion": string, "sections": [{"title": string, "description": string, "bullets": [string]}]}';

const STYLE_HINTS: Record<string, string> = {
  administratif: "ton administratif, formel, phrases complètes, vocabulaire soutenu",
  technique: "ton technique précis, terminologie métier, mesures et références",
  chantier: "ton opérationnel de chantier, avancement, tâches, sécurité, matériel",
  intervention: "ton d'intervention terrain, actions menées, résultats, durée",
  maintenance: "ton de maintenance : équipement, symptômes, diagnostic, actions, pièces",
  mission: "ton de rapport de mission, objectifs, résultats, difficultés, suites",
  visite: "ton de rapport de visite, contexte, personnes rencontrées, constats",
  audit: "ton d'audit, constats, écarts, risques, recommandations, plan d'action",
};

function styleClause(style?: string): string {
  if (!style || !STYLE_HINTS[style]) return "";
  return ` Adopte un ${STYLE_HINTS[style]}.`;
}

// ----- Legacy: extract from PDF (kept for backwards compat with import UI) -----

const pdfInput = z.object({
  pdfBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  filename: z.string().default("document.pdf"),
});

export const extractReportFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => pdfInput.parse(data))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const text = await callGemini({
      model: "gemini-2.5-flash",
      system:
        "Tu es un assistant qui analyse des rapports d'activités PDF en français et en extrait la structure. Réponds uniquement avec un JSON strict.",
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Extrait la structure de ce rapport en JSON exact :\n" +
                REPORT_JSON_SHAPE +
                "\nUtilise le français. Aucun texte hors JSON.",
            },
            { inlineData: { mimeType: data.mimeType, data: data.pdfBase64 } },
          ],
        },
      ],
    });
    return extractedSchema.parse(parseJsonLoose(text));
  });

// ----- Extract from image (OCR + structure) -----

const imageInput = z.object({
  base64: z.string().min(10),
  mimeType: z.string().default("image/jpeg"),
});

export const aiExtractFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => imageInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const text = await callGemini({
      model: "gemini-2.5-flash",
      system:
        "Tu lis des photos de rapports ou de notes manuscrites en français et tu produis un JSON structuré. Réponds uniquement en JSON.",
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "OCR + structure ce document en JSON :\n" +
                REPORT_JSON_SHAPE +
                "\nEn français, JSON uniquement.",
            },
            { inlineData: { mimeType: data.mimeType, data: data.base64 } },
          ],
        },
      ],
    });
    return extractedSchema.parse(parseJsonLoose(text));
  });

// ----- Extract from DOCX (Word) -----

const docxInput = z.object({
  base64: z.string().min(10),
  filename: z.string().default("document.docx"),
});

export const aiExtractFromDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docxInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(data.base64, "base64");
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    const clipped = rawText.slice(0, 30_000);

    const text = await callGemini({
      model: "gemini-2.5-flash",
      system:
        "Tu structures des textes bruts issus de documents Word en rapports JSON en français. Réponds uniquement en JSON.",
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Structure ce contenu Word en JSON exact :\n" +
                REPORT_JSON_SHAPE +
                "\nContenu :\n\n" +
                clipped,
            },
          ],
        },
      ],
    });
    return extractedSchema.parse(parseJsonLoose(text));
  });

// ----- Improve a single text field -----

const improveInput = z.object({
  text: z.string().min(1),
  action: z.enum(["fix-fr", "rephrase", "shorten", "expand"]),
  style: z.string().optional(),
});

const ACTION_INSTRUCTION: Record<string, string> = {
  "fix-fr":
    "Corrige uniquement l'orthographe, la grammaire et la ponctuation. Ne change pas le sens ni le style.",
  rephrase:
    "Reformule pour améliorer la fluidité et la clarté, en conservant tous les faits et le même niveau de détail.",
  shorten:
    "Résume le texte en 40 % environ de sa longueur, en gardant les informations essentielles.",
  expand:
    "Développe le texte avec plus de détails et de nuances, sans inventer de faits.",
};

export const aiImprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => improveInput.parse(d))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const text = await callGemini({
      model: "gemini-2.5-flash",
      system:
        "Tu es un assistant de rédaction professionnelle en français." + styleClause(data.style),
      responseMimeType: "text/plain",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                ACTION_INSTRUCTION[data.action] +
                "\n\nRenvoie uniquement le texte final, sans commentaire ni guillemets.\n\nTEXTE :\n" +
                data.text,
            },
          ],
        },
      ],
    });
    return { text: text.trim() };
  });

// ----- Summarize the full report -----

const reportShape = z.object({
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

const summarizeInput = z.object({
  report: reportShape,
  mode: z.enum(["short", "executive"]),
});

function reportToText(r: z.infer<typeof reportShape>): string {
  const lines: string[] = [];
  if (r.title) lines.push(`# ${r.title}`);
  if (r.intro) lines.push(`\nIntroduction :\n${r.intro}`);
  r.sections.forEach((s, i) => {
    lines.push(`\n## Section ${i + 1} — ${s.title}`);
    if (s.description) lines.push(s.description);
    s.bullets.forEach((b) => lines.push(`- ${b}`));
  });
  if (r.conclusion) lines.push(`\nConclusion :\n${r.conclusion}`);
  return lines.join("\n");
}

export const aiSummarize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => summarizeInput.parse(d))
  .handler(async ({ data }): Promise<{ summary: string }> => {
    const instruction =
      data.mode === "short"
        ? "Rédige un résumé court en 3 à 5 phrases, en français."
        : "Rédige un résumé exécutif structuré (contexte, faits clés, recommandations) en français, ~200 mots.";
    const text = await callGemini({
      model: "gemini-2.5-flash",
      system: "Tu es un assistant de synthèse de rapports professionnels.",
      responseMimeType: "text/plain",
      contents: [
        {
          role: "user",
          parts: [{ text: instruction + "\n\nRAPPORT :\n" + reportToText(data.report) }],
        },
      ],
    });
    return { summary: text.trim() };
  });

// ----- Detect issues -----

const issueSchema = z.object({
  issues: z
    .array(
      z.object({
        type: z.string(),
        message: z.string(),
        location: z.string().default(""),
      }),
    )
    .default([]),
});

const detectInput = z.object({ report: reportShape });

export const aiDetectIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => detectInput.parse(d))
  .handler(async ({ data }): Promise<z.infer<typeof issueSchema>> => {
    const text = await callGemini({
      model: "gemini-2.5-pro",
      system:
        "Tu es un relecteur d'audit. Trouve incohérences (dates, chiffres, montants), affirmations contradictoires, doublons, informations manquantes clés. Réponds en JSON strict.",
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Analyse ce rapport et renvoie ce JSON exact :\n" +
                '{"issues": [{"type": "date"|"montant"|"incohérence"|"doublon"|"manquant"|"autre", "message": string, "location": string}]}\n\n' +
                "RAPPORT :\n" +
                reportToText(data.report),
            },
          ],
        },
      ],
    });
    return issueSchema.parse(parseJsonLoose(text));
  });

// ----- Apply style -----

const applyStyleInput = z.object({
  report: reportShape,
  style: z.string(),
});

export const aiApplyStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applyStyleInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const text = await callGemini({
      model: "gemini-2.5-pro",
      system:
        "Tu reformules des rapports en français en gardant tous les faits mais en changeant le ton." +
        styleClause(data.style),
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Reformule ce rapport dans le style demandé. Renvoie ce JSON exact, sans texte hors JSON :\n" +
                REPORT_JSON_SHAPE +
                "\n\nRAPPORT SOURCE :\n" +
                reportToText(data.report),
            },
          ],
        },
      ],
    });
    return extractedSchema.parse(parseJsonLoose(text));
  });

// ----- Chat (session memory) -----

const chatMsg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const chatInput = z.object({
  history: z.array(chatMsg).default([]),
  userMessage: z.string().min(1),
  reportDraft: reportShape.optional(),
  style: z.string().optional(),
});

const chatReplySchema = z.object({
  reply: z.string().default(""),
  updatedDraft: extractedSchema.nullable().optional(),
  missingInfo: z.array(z.string()).default([]),
});
export type AIChatReply = z.infer<typeof chatReplySchema>;

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => chatInput.parse(d))
  .handler(async ({ data }): Promise<AIChatReply> => {
    const system =
      "Tu es un assistant de rédaction de rapports professionnels en français, comparable à Manus AI. " +
      "Tu aides l'utilisateur à structurer, corriger et compléter son rapport. " +
      "Si tu manques d'informations importantes, pose des questions ciblées avant de rédiger. " +
      "À chaque message, réponds STRICTEMENT en JSON :\n" +
      '{"reply": "ta réponse en markdown à afficher à l\'utilisateur", ' +
      '"updatedDraft": null | ' + REPORT_JSON_SHAPE + ", " +
      '"missingInfo": [string]}\n' +
      "Mets updatedDraft à null si aucun changement au rapport n'est proposé. " +
      "Sinon renvoie le rapport COMPLET mis à jour." +
      styleClause(data.style);

    const contents: GeminiMessage[] = [];
    if (data.reportDraft) {
      contents.push({
        role: "user",
        parts: [
          {
            text:
              "État courant du rapport (référence, ne pas répéter dans reply) :\n" +
              JSON.stringify(data.reportDraft),
          },
        ],
      });
      contents.push({
        role: "model",
        parts: [{ text: '{"reply":"Compris, je tiens compte du brouillon.","updatedDraft":null,"missingInfo":[]}' }],
      });
    }
    for (const m of data.history) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
    contents.push({ role: "user", parts: [{ text: data.userMessage }] });

    const text = await callGemini({
      model: "gemini-2.5-flash",
      system,
      responseMimeType: "application/json",
      contents,
    });
    const parsed = chatReplySchema.parse(parseJsonLoose(text));
    return parsed;
  });

// ----- Generate the full report from the conversation -----

const generateInput = z.object({
  history: z.array(chatMsg).default([]),
  reportDraft: reportShape.optional(),
  style: z.string().optional(),
});

export const aiGenerateFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateInput.parse(d))
  .handler(async ({ data }): Promise<ExtractedReport> => {
    const system =
      "Tu es un rédacteur de rapports professionnels en français. À partir de l'historique de conversation et du brouillon fourni, produis un rapport complet et structuré." +
      styleClause(data.style) +
      " Structure recommandée : Titre, Objet (intro), Contexte, Observations, Analyse, Recommandations, Conclusion. " +
      "Utilise `intro` pour l'objet ; place Contexte / Observations / Analyse / Recommandations comme sections successives. Réponds STRICTEMENT en JSON exact.";
    const convo = data.history
      .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "UTILISATEUR"} : ${m.content}`)
      .join("\n\n");
    const draftJson = data.reportDraft ? JSON.stringify(data.reportDraft) : "aucun";

    const text = await callGemini({
      model: "gemini-2.5-pro",
      system,
      responseMimeType: "application/json",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Rédige le rapport final. JSON exact :\n" +
                REPORT_JSON_SHAPE +
                "\n\nBROUILLON ACTUEL : " +
                draftJson +
                "\n\nCONVERSATION :\n" +
                convo,
            },
          ],
        },
      ],
    });
    return extractedSchema.parse(parseJsonLoose(text));
  });
