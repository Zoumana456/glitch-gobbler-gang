import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, CheckCircle2, Circle, Loader2, XCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { startAgentRun, advanceAgentRun, getAgentRun, cancelAgentRun } from "@/lib/agents/agents.functions";
import type { ExtractedReport } from "@/lib/ai.functions";

const TYPES = [
  { v: "activite", l: "Rapport d'activité" },
  { v: "projets", l: "Suivi des projets" },
  { v: "depenses", l: "Analyse des dépenses" },
  { v: "synthese", l: "Synthèse globale" },
] as const;

const SOURCES = [
  { v: "projects", l: "Projets" },
  { v: "expenses", l: "Dépenses" },
  { v: "tasks", l: "Tâches" },
  { v: "reports", l: "Rapports" },
] as const;

const STEP_LABEL: Record<string, string> = {
  plan: "Orchestrateur — planification",
  collect: "Collecte des données",
  prepare: "Préparation",
  analyze: "Analyse & calculs",
  quality: "Contrôle qualité",
  write: "Rédaction",
  generate: "Génération",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ReportAgentsPanel({
  applyDraft,
  getDraft,
}: {
  applyDraft: (r: ExtractedReport) => void;
  getDraft: () => ExtractedReport;
}) {
  const start = useServerFn(startAgentRun);
  const advance = useServerFn(advanceAgentRun);
  const fetchRun = useServerFn(getAgentRun);
  const cancel = useServerFn(cancelAgentRun);
  const now = new Date();
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("activite");
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [sources, setSources] = useState<string[]>(["projects", "expenses", "tasks", "reports"]);
  const [instr, setInstr] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(id: string) {
    const r = await fetchRun({ data: { id } });
    setTasks(r.tasks);
    setStatus(r.run.status);
    setError(r.run.error_summary ?? null);
    return r;
  }

  async function launch() {
    if (!sources.length) return toast.error("Choisissez au moins une source");
    setBusy(true);
    setError(null);
    try {
      const title = getDraft().title || TYPES.find((t) => t.v === type)!.l;
      const { id } = await start({
        data: { report_type: type, title, instructions: instr, period_start: from, period_end: to, sources: sources as any },
      });
      setRunId(id);
      await refresh(id);
      for (let i = 0; i < 20; i++) {
        const res = await advance({ data: { id } });
        await refresh(id);
        if (res.done) break;
      }
      const final = await refresh(id);
      const w = (final.run.state as any)?.write;
      if (w && ["completed", "completed_with_warnings"].includes(final.run.status)) {
        applyDraft({
          title: w.title,
          intro: w.intro,
          conclusion: w.conclusion,
          sections: (w.sections ?? []).map((s: any) => ({ title: s.title, description: s.text, bullets: [] })),
        } as ExtractedReport);
        toast.success("Rapport des agents inséré dans le formulaire");
      } else if (final.run.status === "failed") {
        toast.error("Mission échouée");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Échec du lancement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="h-4 w-4 text-primary" />
        L'Orchestrateur pilote 6 agents et remplit votre rapport avec des chiffres vérifiés.
      </div>
      <Select value={type} onValueChange={(v) => setType(v as any)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" className="h-8 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" />
        <Input type="date" className="h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SOURCES.map((s) => {
          const on = sources.includes(s.v);
          return (
            <button
              key={s.v}
              type="button"
              onClick={() => setSources((p) => (on ? p.filter((x) => x !== s.v) : [...p, s.v]))}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              {s.l}
            </button>
          );
        })}
      </div>
      <Textarea rows={2} className="text-xs" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Consignes pour les agents (facultatif)" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={busy} onClick={launch}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          Lancer la mission
        </Button>
        {busy && runId && (
          <Button size="sm" variant="outline" onClick={() => cancel({ data: { id: runId } })}>Annuler</Button>
        )}
      </div>
      {tasks.length > 0 && (
        <ul className="space-y-1 rounded-md border border-border p-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-xs">
              {t.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                : t.status === "running" || t.status === "retrying" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                : t.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className={t.status === "pending" ? "text-muted-foreground" : ""}>{STEP_LABEL[t.task_type] ?? t.task_type}</span>
            </li>
          ))}
        </ul>
      )}
      {status && !busy && (
        <p className={`text-xs ${status === "failed" ? "text-destructive" : "text-primary"}`}>
          {status === "failed" ? `Échec : ${error ?? ""}` : "Mission terminée — rapport inséré à gauche."}
        </p>
      )}
    </div>
  );
}
