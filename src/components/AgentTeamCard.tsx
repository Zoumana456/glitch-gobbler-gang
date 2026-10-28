import { CheckCircle2, Circle, Loader2, XCircle, Bot } from "lucide-react";

export type AgentStep = { key: string; label: string; status: "pending" | "running" | "done" | "failed" };

export const STEP_LABEL: Record<string, string> = {
  plan: "Orchestrateur — planification",
  collect: "Agent Collecte — données & documents",
  prepare: "Agent Préparation",
  analyze: "Agent Analyse & calculs",
  quality: "Agent Contrôle qualité",
  write: "Agent Rédaction",
  generate: "Agent Génération — insertion dans le rapport",
};

/** Décide si la consigne demande un rapport bâti sur les données de l'entreprise. */
export function detectDataMission(msg: string): null | {
  report_type: "activite" | "projets" | "depenses" | "synthese";
  sources: ("projects" | "expenses" | "tasks" | "reports")[];
} {
  const m = msg.toLowerCase();
  const wantsReport = /(rapport|synth[eè]se|bilan|point|r[ée]capitulatif)/.test(m);
  const dataWords = /(d[ée]penses?|projets?|t[âa]ches?|activit[ée]|ce mois|du mois|semaine|trimestre|p[ée]riode|mes rapports|chiffres)/.test(m);
  if (!wantsReport || !dataWords) return null;
  if (/d[ée]penses?|frais/.test(m)) return { report_type: "depenses", sources: ["expenses"] };
  if (/projets?/.test(m) && !/activit/.test(m)) return { report_type: "projets", sources: ["projects", "tasks"] };
  if (/synth[eè]se|global/.test(m)) return { report_type: "synthese", sources: ["projects", "expenses", "tasks", "reports"] };
  return { report_type: "activite", sources: ["projects", "expenses", "tasks", "reports"] };
}

export function AgentTeamCard({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="mr-6 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-1.5 font-medium text-primary">
        <Bot className="h-3.5 w-3.5" /> Les agents prennent le relais
      </div>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            {s.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              : s.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              : s.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-destructive" />
              : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={s.status === "pending" ? "text-muted-foreground" : ""}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
