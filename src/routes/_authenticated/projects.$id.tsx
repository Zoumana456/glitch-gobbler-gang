import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, FileDown, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getProject, updateProject, deleteProject, addRow, updateRow, deleteRow,
  uploadProjectFile, fileUrl, removeProjectFile,
  PROJECT_STATUSES, STATUS_LABEL, PRIORITY_LABEL, HEALTH_LABEL, HEALTH_TONE, MILESTONE_LABEL, fmtMoney,
  type Project,
} from "@/lib/projects";
import { ProjectAssistant } from "@/components/projects/ProjectAssistant";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Fiche projet — DailyBrief" },
      { name: "description", content: "Aperçu, jalons, équipe, budget et documents du projet." },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Chargement…</p>;
  if (error || !data?.project) return <div className="p-6 text-sm">Projet introuvable. <Link to="/projects" className="underline">Retour</Link></div>;
  const p = data.project;

  async function patch(v: Partial<Project>) {
    try { await updateProject(id, v); refresh(); qc.invalidateQueries({ queryKey: ["projects"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); refresh(); } catch (e) { toast.error((e as Error).message); } };

  const planned = data.budget.reduce((s, l) => s + Number(l.planned), 0);
  const spent = data.budget.reduce((s, l) => s + Number(l.spent), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild><Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" />Projets</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><FileDown className="mr-1 h-4 w-4" />Exporter PDF</Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!confirm("Supprimer définitivement ce projet ?")) return;
            try { await deleteProject(id); qc.invalidateQueries({ queryKey: ["projects"] }); nav({ to: "/projects" }); } catch (e) { toast.error((e as Error).message); }
          }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div>
        <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{STATUS_LABEL[p.status]}</Badge>
          <span className={`rounded px-2 py-0.5 text-xs ${HEALTH_TONE[p.health]}`}>{HEALTH_LABEL[p.health]}</span>
          <Badge variant="secondary">Priorité {PRIORITY_LABEL[p.priority]?.toLowerCase()}</Badge>
          {p.client && <span className="text-muted-foreground">· {p.client}</span>}
        </div>
        <div className="mt-3 flex items-center gap-3"><Progress value={p.progress} className="h-2 max-w-sm" /><span className="text-sm">{p.progress}%</span></div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap print:hidden">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="milestones">Jalons ({data.milestones.length})</TabsTrigger>
          <TabsTrigger value="team">Équipe ({data.members.length})</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="files">Documents ({data.files.length})</TabsTrigger>
          <TabsTrigger value="ai">Assistante IA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="print:block">
          <Overview p={p} onSave={patch} />
        </TabsContent>

        <TabsContent value="ai">
          <ProjectAssistant projectId={id} onAddMilestones={async (list) => {
            for (const [i, m] of list.entries()) {
              await addRow("project_milestones", { project_id: id, title: m.title, due_date: m.due_date, responsible: m.responsible, position: data.milestones.length + i });
            }
            refresh();
          }} />
        </TabsContent>

        <TabsContent value="milestones">
          <Card><CardContent className="space-y-3 p-4">
            {data.milestones.map((m) => (
              <div key={m.id} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_140px_150px_130px_auto]">
                <Input defaultValue={m.title} onBlur={(e) => e.target.value !== m.title && run(() => updateRow("project_milestones", m.id, { title: e.target.value }))} />
                <Input type="date" defaultValue={m.due_date ?? ""} onBlur={(e) => run(() => updateRow("project_milestones", m.id, { due_date: e.target.value || null }))} />
                <Input placeholder="Responsable" defaultValue={m.responsible} onBlur={(e) => run(() => updateRow("project_milestones", m.id, { responsible: e.target.value }))} />
                <Select value={m.status} onValueChange={(v) => run(async () => {
                  await updateRow("project_milestones", m.id, { status: v });
                  const done = data.milestones.filter((x) => (x.id === m.id ? v : x.status) === "done").length;
                  await updateProject(id, { progress: Math.round((done / data.milestones.length) * 100) });
                  qc.invalidateQueries({ queryKey: ["projects"] });
                })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MILESTONE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => run(() => deleteRow("project_milestones", m.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {data.milestones.length === 0 && <p className="text-sm text-muted-foreground">Aucun jalon. L'avancement se calcule automatiquement à partir des jalons franchis.</p>}
            <Button size="sm" variant="outline" onClick={() => run(() => addRow("project_milestones", { project_id: id, title: "Nouveau jalon", position: data.milestones.length }))}><Plus className="mr-1 h-4 w-4" />Ajouter un jalon</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="team">
          <Card><CardContent className="space-y-3 p-4">
            {data.members.map((m) => (
              <div key={m.id} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input placeholder="Nom" defaultValue={m.name} onBlur={(e) => run(() => updateRow("project_members", m.id, { name: e.target.value }))} />
                <Input placeholder="Rôle" defaultValue={m.role} onBlur={(e) => run(() => updateRow("project_members", m.id, { role: e.target.value }))} />
                <Input placeholder="Contact" defaultValue={m.contact} onBlur={(e) => run(() => updateRow("project_members", m.id, { contact: e.target.value }))} />
                <Button variant="ghost" size="icon" onClick={() => run(() => deleteRow("project_members", m.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => run(() => addRow("project_members", { project_id: id, name: "Nouvel intervenant" }))}><Plus className="mr-1 h-4 w-4" />Ajouter un intervenant</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card><CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <Stat label="Budget alloué" v={fmtMoney(p.budget, p.currency)} />
              <Stat label="Total prévu" v={fmtMoney(planned, p.currency)} />
              <Stat label="Total engagé" v={fmtMoney(spent, p.currency)} />
              <Stat label="Écart" v={fmtMoney(planned - spent, p.currency)} danger={spent > planned} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1">Poste</th><th className="p-1">Prévu</th><th className="p-1">Engagé</th><th className="p-1">Écart</th><th /></tr></thead>
                <tbody>
                  {data.budget.map((l) => (
                    <tr key={l.id}>
                      <td className="p-1"><Input defaultValue={l.label} onBlur={(e) => run(() => updateRow("project_budget_lines", l.id, { label: e.target.value }))} /></td>
                      <td className="p-1"><Input type="number" defaultValue={l.planned} onBlur={(e) => run(() => updateRow("project_budget_lines", l.id, { planned: Number(e.target.value) || 0 }))} /></td>
                      <td className="p-1"><Input type="number" defaultValue={l.spent} onBlur={(e) => run(() => updateRow("project_budget_lines", l.id, { spent: Number(e.target.value) || 0 }))} /></td>
                      <td className={`p-1 whitespace-nowrap ${Number(l.spent) > Number(l.planned) ? "text-destructive" : ""}`}>{fmtMoney(Number(l.planned) - Number(l.spent), p.currency)}</td>
                      <td className="p-1"><Button variant="ghost" size="icon" onClick={() => run(() => deleteRow("project_budget_lines", l.id))}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="outline" onClick={() => run(() => addRow("project_budget_lines", { project_id: id, label: "Nouveau poste", position: data.budget.length }))}><Plus className="mr-1 h-4 w-4" />Ajouter un poste</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="files">
          <Card><CardContent className="space-y-3 p-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="h-4 w-4" />Téléverser des fichiers (30 Mo max)
              <input type="file" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                for (const f of files) await run(() => uploadProjectFile(id, f));
                if (files.length) toast.success(`${files.length} fichier(s) ajouté(s)`);
                e.target.value = "";
              }} />
            </label>
            {data.files.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">{f.file_name} <span className="text-xs text-muted-foreground">· {(f.size_bytes / 1024 / 1024).toFixed(2)} Mo</span></span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={async () => { try { window.open(await fileUrl(f.storage_path), "_blank"); } catch (e) { toast.error((e as Error).message); } }}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => run(() => removeProjectFile(f))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, v, danger }: { label: string; v: string; danger?: boolean }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`font-semibold ${danger ? "text-destructive" : ""}`}>{v}</div></div>;
}

function Overview({ p, onSave }: { p: Project; onSave: (v: Partial<Project>) => Promise<void> }) {
  const [f, setF] = useState(p);
  useEffect(() => setF(p), [p]);
  const set = (k: keyof Project) => (e: any) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Fiche d'identité & cadrage</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <F l="Titre"><Input value={f.title} onChange={set("title")} /></F>
          <F l="Client / Commanditaire"><Input value={f.client} onChange={set("client")} /></F>
          <F l="Catégorie"><Input value={f.category} onChange={set("category")} /></F>
          <F l="Chef de projet"><Input value={f.manager_name} onChange={set("manager_name")} /></F>
          <F l="Lancement"><Input type="date" value={f.start_date ?? ""} onChange={set("start_date")} /></F>
          <F l="Livraison cible"><Input type="date" value={f.end_date ?? ""} onChange={set("end_date")} /></F>
          <F l="Statut"><Sel v={f.status} on={set("status")} opts={PROJECT_STATUSES as any} /></F>
          <F l="Santé"><Sel v={f.health} on={set("health")} opts={Object.entries(HEALTH_LABEL)} /></F>
          <F l="Priorité"><Sel v={f.priority} on={set("priority")} opts={Object.entries(PRIORITY_LABEL)} /></F>
          <F l="Budget alloué"><Input type="number" value={f.budget} onChange={set("budget")} /></F>
          <F l="Avancement (%)"><Input type="number" min={0} max={100} value={f.progress} onChange={set("progress")} /></F>
        </div>
        <F l="Synthèse exécutive"><Textarea rows={3} value={f.summary} onChange={set("summary")} /></F>
        <F l="Contexte"><Textarea rows={3} value={f.context} onChange={set("context")} /></F>
        <F l="Objectifs"><Textarea rows={3} value={f.objectives} onChange={set("objectives")} /></F>
        <F l="Livrables"><Textarea rows={3} value={f.deliverables} onChange={set("deliverables")} /></F>
        <div className="flex justify-end print:hidden">
          <Button onClick={async () => {
            await onSave({
              title: f.title, client: f.client, category: f.category, manager_name: f.manager_name,
              start_date: f.start_date || null, end_date: f.end_date || null, status: f.status, health: f.health,
              priority: f.priority, budget: Number(f.budget) || 0,
              progress: Math.max(0, Math.min(100, Number(f.progress) || 0)),
              summary: f.summary, context: f.context, objectives: f.objectives, deliverables: f.deliverables,
            });
            toast.success("Projet enregistré");
          }}>Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{l}</Label>{children}</div>;
}
function Sel({ v, on, opts }: { v: string; on: (v: string) => void; opts: readonly (readonly [string, string])[] }) {
  return <Select value={v} onValueChange={on}><SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>{opts.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>;
}
