import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { combinedReportRange } from "@/lib/combined-report-range";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MonthlyReportButton } from "@/components/MonthlyReportButton";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Choisir une plage de jours (semaine, 7/14 jours, libre) et générer un rapport consolidé. */
export function CombineDaysButton() {
  const today = new Date();
  const [start, setStart] = useState(iso(startOfWeek(today, { weekStartsOn: 1 })));
  const [end, setEnd] = useState(iso(today));
  const range = combinedReportRange(start, end);

  const presets = [
    { label: "Cette semaine", s: startOfWeek(today, { weekStartsOn: 1 }), e: today },
    { label: "Semaine dernière", s: startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), e: endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }) },
    { label: "7 derniers jours", s: subDays(today, 6), e: today },
    { label: "14 derniers jours", s: subDays(today, 13), e: today },
  ];


  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><CalendarDays className="h-4 w-4 mr-2" />Combiner des jours</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rapport sur plusieurs jours</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant="secondary" onClick={() => { setStart(iso(p.s)); setEnd(iso(p.e)); }}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm font-medium">Du
            <Input type="date" value={start} max={iso(today)} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm font-medium">Au
            <Input type="date" value={end} max={iso(today)} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {range ? `${range.days} jour${range.days > 1 ? "s" : ""} couvert${range.days > 1 ? "s" : ""}. Toute l'activité de la période sera reprise.` : "Renseignez deux dates valides."}
        </p>
        {range ? <MonthlyReportButton
          monthKey={range.start.slice(0, 7)}
          range={range}
          label="Générer le rapport"
        /> : <Button disabled>Générer le rapport</Button>}
      </DialogContent>
    </Dialog>
  );
}
