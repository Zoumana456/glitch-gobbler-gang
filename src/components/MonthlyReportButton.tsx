import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { startAgentRun, advanceAgentRun, getAgentRun } from "@/lib/agents/agents.functions";

const LABELS: Record<string, string> = {
  plan: "Planification",
  collect: "Collecte de tout le mois",
  prepare: "Préparation",
  analyze: "Analyse & calculs",
  quality: "Contrôle qualité",
  write: "Rédaction",
  generate: "Création du rapport",
};

/** Génère en un clic le rapport mensuel de tout ce qui a été fait sur le mois (clé yyyy-MM). */
export function MonthlyReportButton({
  monthKey,
  size = "default",
  variant = "default",
}: {
  monthKey: string;
  size?: "default" | "sm";
  variant?: "default" | "outline" | "ghost";
}) {
  const start = useServerFn(startAgentRun);
  const advance = useServerFn(advanceAgentRun);
  const getRun = useServerFn(getAgentRun);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<string | null>(null);

  async function run(e: React.MouseEvent) {
    e.stopPropagation();
    if (step) return;
    const first = parseISO(`${monthKey}-01`);
    const label = format(first, "LLLL yyyy", { locale: fr });
    const cap = label.charAt(0).toUpperCase() + label.slice(1);
    setStep("plan");
    try {
      const { id } = await start({
        data: {
          report_type: "synthese",
          title: `Rapport mensuel — ${cap}`,
          instructions:
            "Rapport mensuel consolidé : synthèse de tout ce qui a été fait durant le mois (rapports journaliers, projets, tâches, dépenses). Faits marquants, réalisations, difficultés, chiffres clés, perspectives.",
          period_start: format(first, "yyyy-MM-dd"),
          period_end: format(endOfMonth(first), "yyyy-MM-dd"),
          sources: ["reports", "projects", "tasks", "expenses"],
        },
      });
      const order = Object.keys(LABELS);
      for (let i = 0; i < 30; i++) {
        const r = await advance({ data: { id } });
        if (r.done) break;
        const { run: cur } = await getRun({ data: { id } });
        if (cur?.current_step) setStep(order[Math.min(order.indexOf(cur.current_step) + 1, order.length - 1)] ?? cur.current_step);
      }
      const { run: fin } = await getRun({ data: { id } });
      if (!fin?.result_report_id) throw new Error(fin?.error_summary || "La génération n'a pas abouti.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`Rapport mensuel ${cap} prêt`);
      navigate({ to: "/reports/$id", params: { id: fin.result_report_id } });
    } catch (err: any) {
      toast.error(err?.message ?? "Génération impossible");
    } finally {
      setStep(null);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={run} disabled={!!step}>
      {step ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarRange className="h-4 w-4 mr-2" />}
      {step ? LABELS[step] ?? "Génération…" : "Rapport mensuel"}
    </Button>
  );
}
