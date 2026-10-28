import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getAgentCenter, startAgentRun } from "@/lib/agents/agents.functions";
import { RUN_STATUS } from "@/lib/agents/labels";

export const Route = createFileRoute("/_authenticated/ai-center/")({
  head: () => ({
    meta: [
      { title: "Centre IA — DailyBrief" },
      { name: "description", content: "Équipe d'agents IA pilotée par un Orchestrateur pour produire vos rapports." },
    ],
  }),
  component: AICenter,
});

const TYPES = [
  { v: "activite", l: "Rapport d'activité" },
  { v: "projets", l: "Suivi des projets" },
  { v: "depenses", l: "Synthèse des dépenses" },
  { v: "synthese", l: "Synthèse de mes rapports" },
] as const;
const SOURCES = [
  { v: "projects", l: "Projets (jalons, budgets)" },
  { v: "expenses", l: "Notes de frais" },
  { v: "tasks", l: "Tâches" },
  { v: "reports", l: "Mes rapports de la période" },
] as const;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function AICenter() {
  const fetchCenter = useServerFn(getAgentCenter);
  const start = useServerFn(startAgentRun);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["ai-center"], queryFn: () => fetchCenter(), refetchInterval: 5000 });
  const now = new Date();
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("activite");
  const [title, setTitle] = useState("Rapport d'activité");
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [sources, setSources] = useState<string[]>(["projects", "expenses", "tasks", "reports"]);
  const [instr, setInstr] = useState("");
  const [busy, setBusy] = useState(false);

  const launch = async () => {
    setBusy(true);
    try {
      const r = await start({
        data: { report_type: type, title, instructions: instr, period_start: from, period_end: to, sources: sources as any },
      });
      navigate({ to: "/ai-center/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du lancement");
    } finally {
      setBusy(false);
    }
  };

  const running = (q.data?.runs ?? []).find((r) => ["planning", "running"].includes(r.status));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Centre d'intelligence artificielle</h1>
          <p className="text-sm text-muted-foreground">Un Orchestrateur pilote 6 agents spécialisés pour produire vos rapports.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Lancer un rapport</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <Button key={t.v} variant={type === t.v ? "default" : "outline"} size="sm" onClick={() => { setType(t.v); setTitle(t.l); }}>
                  {t.l}
                </Button>
              ))}
            </div>
            <div className="space-y-1"><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label>Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Sources autorisées</Label>
              {SOURCES.map((s) => (
                <label key={s.v} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={sources.includes(s.v)}
                    onCheckedChange={(c) => setSources((prev) => (c ? [...prev, s.v] : prev.filter((x) => x !== s.v)))}
                  />
                  {s.l}
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Consignes pour l'Orchestrateur (facultatif)</Label>
              <Textarea rows={3} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Ex. : insister sur les retards de chantier et les dépassements de budget" />
            </div>
            <Button className="w-full" disabled={busy || !sources.length || !!running} onClick={launch}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Lancer l'équipe IA
            </Button>
            {running && (
              <p className="text-xs text-muted-foreground">
                Une exécution est en cours : <Link className="underline" to="/ai-center/$id" params={{ id: running.id }}>la suivre</Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Équipe d'agents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(q.data?.agents ?? []).map((a) => {
              const s = q.data?.stats[a.code];
              const active = (s?.running ?? 0) > 0;
              return (
                <div key={a.code} className={`rounded-md border p-3 ${a.code === "orchestrator" ? "border-primary/40 bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{a.name} <span className="text-xs text-muted-foreground">· {a.role}</span></div>
                    <Badge variant={!a.is_enabled ? "outline" : active ? "default" : "secondary"}>
                      {!a.is_enabled ? "Désactivé" : active ? "En cours" : "Disponible"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s?.done ?? 0} réussie(s) · {s?.failed ?? 0} échec(s){s?.last ? ` · dernière : ${new Date(s.last).toLocaleString("fr-FR")}` : ""}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historique des exécutions</CardTitle></CardHeader>
        <CardContent>
          {!q.data?.runs.length ? (
            <p className="text-sm text-muted-foreground">Aucune exécution pour l'instant.</p>
          ) : (
            <div className="divide-y">
              {q.data.runs.map((r) => (
                <Link key={r.id} to="/ai-center/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.period_start} → {r.period_end} · {new Date(r.created_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  <Badge variant={RUN_STATUS[r.status]?.variant ?? "secondary"}>{RUN_STATUS[r.status]?.label ?? r.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
