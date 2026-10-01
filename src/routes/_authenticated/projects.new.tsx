import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject, PRIORITY_LABEL, PROJECT_STATUSES } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/projects/new")({
  head: () => ({
    meta: [
      { title: "Nouveau projet — DailyBrief" },
      { name: "description", content: "Créez un projet : identité, dates, objectifs et budget." },
    ],
  }),
  component: NewProject,
});

const STEPS = ["Identité", "Dates & responsable", "Cadrage", "Budget"];

function NewProject() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "", client: "", category: "", priority: "normal", status: "draft",
    manager_name: "", start_date: "", end_date: "",
    context: "", objectives: "", deliverables: "",
    budget: "", currency: "XOF",
  });
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  async function submit() {
    if (f.title.trim().length < 2) { setStep(0); return toast.error("Le titre est obligatoire"); }
    setBusy(true);
    try {
      const id = await createProject({
        ...f,
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        budget: Number(f.budget) || 0,
      } as any);
      toast.success("Projet créé");
      nav({ to: "/projects/$id", params: { id } });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nouveau projet</h1>
        <Button variant="ghost" asChild><Link to="/projects">Annuler</Link></Button>
      </div>
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${i === step ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{i + 1}. {s}</button>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{STEPS[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && <>
            <Field label="Titre du projet *"><Input value={f.title} onChange={set("title")} /></Field>
            <Field label="Client / Direction commanditaire"><Input value={f.client} onChange={set("client")} /></Field>
            <Field label="Catégorie / Type"><Input value={f.category} onChange={set("category")} placeholder="Ex. Construction, Informatique, Formation…" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priorité">
                <Select value={f.priority} onValueChange={set("priority")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="Statut initial">
                <Select value={f.status} onValueChange={set("status")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </Field>
            </div>
          </>}
          {step === 1 && <>
            <Field label="Chef de projet"><Input value={f.manager_name} onChange={set("manager_name")} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date de lancement"><Input type="date" value={f.start_date} onChange={set("start_date")} /></Field>
              <Field label="Livraison cible"><Input type="date" value={f.end_date} onChange={set("end_date")} /></Field>
            </div>
          </>}
          {step === 2 && <>
            <Field label="Contexte"><Textarea rows={4} value={f.context} onChange={set("context")} /></Field>
            <Field label="Objectifs"><Textarea rows={4} value={f.objectives} onChange={set("objectives")} /></Field>
            <Field label="Livrables attendus"><Textarea rows={3} value={f.deliverables} onChange={set("deliverables")} /></Field>
          </>}
          {step === 3 && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget alloué"><Input type="number" min="0" value={f.budget} onChange={set("budget")} /></Field>
            <Field label="Devise">
              <Select value={f.currency} onValueChange={set("currency")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[["XOF", "FCFA"], ["EUR", "EUR"], ["USD", "USD"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
            </Field>
          </div>}
          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</Button>
            {step < STEPS.length - 1
              ? <Button onClick={() => setStep(step + 1)}>Suivant</Button>
              : <Button disabled={busy} onClick={submit}>{busy ? "Création…" : "Créer le projet"}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
