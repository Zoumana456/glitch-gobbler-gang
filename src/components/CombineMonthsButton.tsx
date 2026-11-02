import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { format, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthlyReportButton } from "@/components/MonthlyReportButton";

/** Choisir deux mois et générer un seul rapport consolidé couvrant toute la période. */
export function CombineMonthsButton() {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const d = subMonths(now, i);
      const l = format(d, "LLLL yyyy", { locale: fr });
      return { key: format(d, "yyyy-MM"), label: l.charAt(0).toUpperCase() + l.slice(1) };
    });
  }, []);
  const [a, setA] = useState(months[1].key);
  const [b, setB] = useState(months[0].key);
  const [start, end] = a <= b ? [a, b] : [b, a];

  const pick = (v: string, set: (s: string) => void, label: string) => (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <Select value={v} onValueChange={set}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {months.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><Layers className="h-4 w-4 mr-2" />Combiner 2 mois</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rapport combiné sur deux mois</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {pick(a, setA, "Premier mois")}
          {pick(b, setB, "Second mois")}
        </div>
        <p className="text-sm text-muted-foreground">
          Toute l'activité de la période sera reprise (rapports, projets, tâches, dépenses).
        </p>
        <MonthlyReportButton monthKey={start} endMonthKey={end} label="Générer le rapport combiné" />
      </DialogContent>
    </Dialog>
  );
}
