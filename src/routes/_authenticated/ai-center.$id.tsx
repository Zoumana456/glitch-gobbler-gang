import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle, Circle, FileText, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { advanceAgentRun, cancelAgentRun, getAgentRun } from "@/lib/agents/agents.functions";
import { AGENT_NAME, RUN_STATUS, TASK_STATUS } from "@/lib/agents/labels";

export const Route = createFileRoute("/_authenticated/ai-center/$id")({
  head: () => ({
    meta: [
      { title: "Suivi d'exécution — Centre IA DailyBrief" },
      { name: "description", content: "Progression des agents IA, contrôles qualité et journal d'audit." },
    ],
  }),
  component: RunPage,
});

function RunPage() {
  const { id } = Route.useParams();
  const fetchRun = useServerFn(getAgentRun);
  const advance = useServerFn(advanceAgentRun);
  const cancel = useServerFn(cancelAgentRun);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ai-run", id], queryFn: () => fetchRun({ data: { id } }) });
  const looping = useRef(false);
  const status = q.data?.run.status;

  useEffect(() => {
    if (!status || !["planning", "running"].includes(status) || looping.current) return;
    looping.current = true;
    (async () => {
      try {
        for (let i = 0; i < 20; i++) {
          const r = await advance({ data: { id } });
          await qc.invalidateQueries({ queryKey: ["ai-run", id] });
          if (r.done) break;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur de l'Orchestrateur");
      } finally {
        looping.current = false;
        qc.invalidateQueries({ queryKey: ["ai-run", id] });
      }
    })();
  }, [status, id, advance, qc]);

  if (!q.data) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  const { run, tasks, logs } = q.data;
  const st = RUN_STATUS[run.status] ?? { label: run.status, variant: "secondary" as const };
  const active = ["planning", "running"].includes(run.status);
  const quality = run.state?.quality;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link to="/ai-center" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Centre IA
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{run.title}</h1>
          <p className="text-sm text-muted-foreground">
            Période {run.period_start} → {run.period_end} · Exécution {run.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={st.variant}>{st.label}</Badge>
          {active && (
            <Button size="sm" variant="outline" onClick={async () => { await cancel({ data: { id } }); qc.invalidateQueries({ queryKey: ["ai-run", id] }); }}>
              <Square className="mr-1 h-3 w-3" /> Annuler
            </Button>
          )}
          {run.result_report_id && (
            <Button size="sm" asChild>
              <Link to="/reports/$id" params={{ id: run.result_report_id }}><FileText className="mr-1 h-4 w-4" /> Ouvrir le rapport</Link>
            </Button>
          )}
        </div>
      </div>

      {run.error_summary && (
        <Card className="border-destructive/40"><CardContent className="pt-6 text-sm text-destructive">{run.error_summary}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>Plan de l'Orchestrateur</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-md border p-3">
              {t.status === "done" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                : t.status === "failed" ? <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                : t.status === "running" || t.status === "retrying" ? <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
                : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{AGENT_NAME[t.agent_code] ?? t.agent_code}</span>
                  <span className="text-xs text-muted-foreground">{TASK_STATUS[t.status] ?? t.status}{t.attempt_count > 1 ? ` · tentative ${t.attempt_count}` : ""}</span>
                </div>
                {t.error_message && <p className="text-xs text-destructive">{t.error_message}</p>}
                <TaskSummary type={t.task_type} output={t.output} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {quality && (
        <Card>
          <CardHeader><CardTitle>Contrôle qualité : {quality.statut}</CardTitle></CardHeader>
          <CardContent>
            {quality.controles?.length ? (
              <ul className="space-y-1 text-sm">
                {quality.controles.map((c: any, i: number) => (
                  <li key={i} className={c.niveau === "bloquant" ? "text-destructive" : "text-muted-foreground"}>• {c.message}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Tous les contrôles obligatoires sont réussis.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Journal d'audit</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          {logs.map((l) => (
            <div key={l.id}>
              {new Date(l.created_at).toLocaleTimeString("fr-FR")} — {AGENT_NAME[l.actor_id] ?? (l.actor_type === "user" ? "Vous" : l.actor_id)} : {l.event_type}
              {l.event_details?.task ? ` (${l.event_details.task})` : ""}
              {l.event_details?.error ? ` — ${l.event_details.error}` : ""}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskSummary({ type, output }: { type: string; output: any }) {
  if (!output) return null;
  const cls = "mt-1 text-xs text-muted-foreground";
  if (type === "plan") return <p className={cls}>{output.objectif}</p>;
  if (type === "collect")
    return <p className={cls}>{(output.provenance ?? []).map((p: any) => `${p.source} : ${p.count}${p.error ? " (erreur)" : ""}`).join(" · ")}</p>;
  if (type === "prepare") return <p className={cls}>{(output.anomalies ?? []).length} anomalie(s) détectée(s)</p>;
  if (type === "analyze") {
    const i = output.indicateurs ?? {};
    const parts: string[] = [];
    if (i.projets) parts.push(`${i.projets.length} projet(s)`);
    if (i.depenses) parts.push(`dépenses ${i.depenses.total.toLocaleString("fr-FR")}`);
    if (i.taches) parts.push(`${i.taches.terminees_periode} tâche(s) terminée(s), ${i.taches.en_retard} en retard`);
    if (i.rapports) parts.push(`${i.rapports.nombre} rapport(s)`);
    return <p className={cls}>{parts.join(" · ")}</p>;
  }
  if (type === "quality") return <p className={cls}>{output.statut}</p>;
  if (type === "write") return <p className={cls}>{output.title} — {output.sections?.length ?? 0} partie(s)</p>;
  if (type === "generate") return <p className={cls}>Rapport créé en brouillon</p>;
  return null;
}
