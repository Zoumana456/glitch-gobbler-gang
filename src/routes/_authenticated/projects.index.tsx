import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Briefcase, Plus, LayoutList, Columns3, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listProjects,
  PROJECT_STATUSES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  HEALTH_LABEL,
  HEALTH_TONE,
  fmtMoney,
  type Project,
} from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projets — DailyBrief" },
      { name: "description", content: "Portefeuille de projets : tableau, Kanban, budgets et avancement." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [view, setView] = useState<"table" | "kanban">("table");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const filtered = useMemo(
    () =>
      data.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (priority === "all" || p.priority === priority) &&
          `${p.code} ${p.title} ${p.client} ${p.manager_name}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q, status, priority],
  );

  const now = new Date();
  const kpis = [
    { label: "Projets", value: data.length },
    { label: "Actifs", value: data.filter((p) => p.status === "active").length },
    { label: "Budget global", value: fmtMoney(data.reduce((s, p) => s + Number(p.budget || 0), 0)) },
    {
      label: "Échéance ce mois",
      value: data.filter((p) => {
        if (!p.end_date || p.status === "completed") return false;
        const d = new Date(p.end_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Briefcase className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">Projets</h1>
            <p className="text-sm text-muted-foreground">Montage, pilotage et suivi de vos projets.</p>
          </div>
        </div>
        <Button asChild><Link to="/projects/new"><Plus className="mr-1 h-4 w-4" />Nouveau projet</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-xl font-semibold">{k.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {PROJECT_STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border">
          <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}><LayoutList className="mr-1 h-4 w-4" />Tableau</Button>
          <Button size="sm" variant={view === "kanban" ? "secondary" : "ghost"} onClick={() => setView("kanban")}><Columns3 className="mr-1 h-4 w-4" />Kanban</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Aucun projet pour le moment.</CardContent></Card>
      ) : view === "table" ? (
        <Card><CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>{["Code", "Projet", "Client", "Responsable", "Échéance", "Avancement", "Budget", "Statut"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2"><Link to="/projects/$id" params={{ id: p.id }} className="font-medium hover:underline">{p.title}</Link></td>
                  <td className="px-3 py-2">{p.client || "—"}</td>
                  <td className="px-3 py-2">{p.manager_name || "—"}</td>
                  <td className="px-3 py-2">{p.end_date ? new Date(p.end_date).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><Progress value={p.progress} className="h-2 w-20" /><span className="text-xs">{p.progress}%</span></div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtMoney(p.budget, p.currency)}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PROJECT_STATUSES.map(([v, l]) => {
            const col = filtered.filter((p) => p.status === v);
            return (
              <div key={v} className="w-72 shrink-0 rounded-lg bg-muted/40 p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-sm font-medium">{l}<span className="text-xs text-muted-foreground">{col.length}</span></div>
                <div className="space-y-2">{col.map((p) => <KanbanCard key={p.id} p={p} />)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanCard({ p }: { p: Project }) {
  return (
    <Link to="/projects/$id" params={{ id: p.id }}>
      <Card className="transition hover:shadow-md"><CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-mono">{p.code}</span><span className={`rounded px-1.5 py-0.5 ${HEALTH_TONE[p.health]}`}>{HEALTH_LABEL[p.health]}</span></div>
        <div className="font-medium leading-tight">{p.title}</div>
        {p.client && <div className="text-xs text-muted-foreground">{p.client}</div>}
        <Progress value={p.progress} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground"><span>{p.progress}%</span><span>{fmtMoney(p.budget, p.currency)}</span></div>
      </CardContent></Card>
    </Link>
  );
}
