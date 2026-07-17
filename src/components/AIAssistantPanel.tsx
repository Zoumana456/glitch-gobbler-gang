import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  FileUp,
  Image as ImageIcon,
  FileText,
  Wand2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import {
  aiChat,
  aiGenerateFull,
  aiDetectIssues,
  aiSummarize,
  aiApplyStyle,
  aiExtractFromImage,
  aiExtractFromDocx,
  extractReportFromPdf,
  type ExtractedReport,
} from "@/lib/ai.functions";

type Message = { role: "user" | "assistant"; content: string };

export type AIStyle =
  | "free"
  | "administratif"
  | "technique"
  | "chantier"
  | "intervention"
  | "maintenance"
  | "mission"
  | "visite"
  | "audit";

const STYLES: { value: AIStyle; label: string }[] = [
  { value: "free", label: "Style libre" },
  { value: "administratif", label: "Administratif" },
  { value: "technique", label: "Technique" },
  { value: "chantier", label: "Chantier" },
  { value: "intervention", label: "Intervention" },
  { value: "maintenance", label: "Maintenance" },
  { value: "mission", label: "Mission" },
  { value: "visite", label: "Visite" },
  { value: "audit", label: "Audit" },
];


async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AIAssistantPanel({
  open,
  onClose,
  getDraft,
  applyDraft,
  style,
  onStyleChange,
}: {
  open: boolean;
  onClose: () => void;
  getDraft: () => ExtractedReport;
  applyDraft: (r: ExtractedReport) => void;
  style: AIStyle;
  onStyleChange: (s: AIStyle) => void;
}) {
  const chat = useServerFn(aiChat);
  const generate = useServerFn(aiGenerateFull);
  const detect = useServerFn(aiDetectIssues);
  const summarize = useServerFn(aiSummarize);
  const applyStyle = useServerFn(aiApplyStyle);
  const extractImg = useServerFn(aiExtractFromImage);
  const extractDocx = useServerFn(aiExtractFromDocx);
  const extractPdf = useServerFn(extractReportFromPdf);

  const [history, setHistory] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis votre assistant de rédaction. Décrivez votre activité et je structurerai le rapport, ou cliquez sur **Générer le rapport** quand vous êtes prêt.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<
    { type: string; message: string; location: string }[] | null
  >(null);

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    const nextHist: Message[] = [...history, { role: "user", content: msg }];
    setHistory(nextHist);
    setBusy(true);
    try {
      const res = await chat({
        data: {
          history,
          userMessage: msg,
          reportDraft: getDraft(),
          style: style === "free" ? undefined : style,
        },
      });
      setHistory([...nextHist, { role: "assistant", content: res.reply || "…" }]);
      if (res.updatedDraft) {
        applyDraft(res.updatedDraft);
        toast.success("Brouillon mis à jour");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur IA");
      setHistory([
        ...nextHist,
        { role: "assistant", content: "⚠️ " + (e?.message ?? "Erreur IA") },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function doGenerate() {
    setBusy(true);
    try {
      const res = await generate({
        data: { history, reportDraft: getDraft(), style: style === "free" ? undefined : style },
      });
      applyDraft(res);
      toast.success("Rapport généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Génération impossible");
    } finally {
      setBusy(false);
    }
  }

  async function doDetect() {
    setBusy(true);
    setIssues(null);
    try {
      const res = await detect({ data: { report: getDraft() } });
      setIssues(res.issues);
      if (res.issues.length === 0) toast.success("Aucune incohérence détectée");
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setBusy(false);
    }
  }

  async function doSummarize() {
    setBusy(true);
    try {
      const res = await summarize({ data: { report: getDraft(), mode: "executive" } });
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "**Résumé exécutif :**\n\n" + res.summary },
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Résumé impossible");
    } finally {
      setBusy(false);
    }
  }

  async function doApplyStyle() {
    if (!style) {
      toast.error("Choisissez un style d'abord");
      return;
    }
    setBusy(true);
    try {
      const res = await applyStyle({ data: { report: getDraft(), style } });
      applyDraft(res);
      toast.success("Style appliqué");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      let res: ExtractedReport;
      if (file.type.startsWith("image/")) {
        res = await extractImg({ data: { base64, mimeType: file.type } });
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        res = await extractDocx({ data: { base64, filename: file.name } });
      } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        res = await extractPdf({
          data: { pdfBase64: base64, mimeType: "application/pdf", filename: file.name },
        });
      } else {
        toast.error("Format non supporté (PDF, DOCX ou image)");
        return;
      }
      applyDraft(res);
      toast.success("Contenu importé");
    } catch (e: any) {
      toast.error(e?.message ?? "Import impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="font-semibold">Assistant IA</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Style :</span>
          <Select value={style} onValueChange={(v) => onStyleChange(v as AIStyle)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLES.map((s) => (
                <SelectItem key={s.value || "free"} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={doGenerate}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Générer
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={doApplyStyle}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Style
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={doDetect}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Incohérences
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={doSummarize}>
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
            Résumer
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <div className="border border-input rounded-md h-8 flex items-center justify-center text-xs cursor-pointer hover:bg-accent">
              <ImageIcon className="h-3.5 w-3.5 mr-1" /> Image
            </div>
          </label>
          <label>
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <div className="border border-input rounded-md h-8 flex items-center justify-center text-xs cursor-pointer hover:bg-accent">
              <FileText className="h-3.5 w-3.5 mr-1" /> Word
            </div>
          </label>
          <label>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <div className="border border-input rounded-md h-8 flex items-center justify-center text-xs cursor-pointer hover:bg-accent">
              <FileUp className="h-3.5 w-3.5 mr-1" /> PDF
            </div>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {issues && (
          <Card className="p-3 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Incohérences ({issues.length})
            </div>
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune détectée.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {issues.map((i, idx) => (
                  <li key={idx}>
                    <span className="font-medium">[{i.type}]</span> {i.message}
                    {i.location ? (
                      <span className="text-muted-foreground"> — {i.location}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm"
                : "mr-6 rounded-lg bg-muted px-3 py-2 text-sm prose prose-sm max-w-none dark:prose-invert"
            }
          >
            {m.role === "assistant" ? (
              <ReactMarkdown>{m.content}</ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> L'assistant réfléchit…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2">
        <Textarea
          rows={2}
          placeholder="Décrivez votre activité, une question, un ajout…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={busy || !input.trim()} onClick={send}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
