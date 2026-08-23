import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { listTeamAbsences } from "@/lib/leaves/leaves.functions";
import { LEAVE_STATUS_LABELS } from "@/lib/leaves/types";

export const Route = createFileRoute("/_authenticated/leaves/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des absences — DailyBrief" },
      {
        name: "description",
        content:
          "Visualisez mois par mois les congés et absences de toute votre entreprise.",
      },
      { property: "og:title", content: "Calendrier des absences — DailyBrief" },
      {
        property: "og:description",
        content: "Planning des congés de l'entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaveCalendarPage,
});

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function LeaveCalendarPage() {
  const listFn = useServerFn(listTeamAbsences);
  const [monthOffset, setMonthOffset] = useState(0);

  const { first, last, label } = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const f = new Date(base.getFullYear(), base.getMonth(), 1);
    const l = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      first: f,
      last: l,
      label: f.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    };
  }, [monthOffset]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["leaves", "calendar", iso(first)],
    queryFn: () => listFn({ data: { from: iso(first), to: iso(last) } }),
  });

  const cells = useMemo(() => {
    const startPad = (first.getDay() + 6) % 7;
    const out: { date: Date | null }[] = Array.from({ length: startPad }, () => ({
      date: null,
    }));
    for (let d = 1; d <= last.getDate(); d += 1)
      out.push({ date: new Date(first.getFullYear(), first.getMonth(), d) });
    return out;
  }, [first, last]);

  function absencesOn(date: Date) {
    const key = iso(date);
    return data.filter((r) => r.start_date <= key && r.end_date >= key);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/leaves">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux congés
        </Link>
      </Button>

      <header className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <CalendarRange className="h-6 w-6 text-primary" />
            Calendrier des absences
          </h1>
          <p className="text-sm capitalize text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Mois précédent"
            onClick={() => setMonthOffset((v) => v - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
            Ce mois
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Mois suivant"
            onClick={() => setMonthOffset((v) => v + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {DAY_LABELS.map((d, i) => (
              <div key={`${d}-${i}`} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c.date) return <div key={`pad-${i}`} className="min-h-16" />;
              const items = absencesOn(c.date);
              const weekend = c.date.getDay() === 0 || c.date.getDay() === 6;
              return (
                <div
                  key={iso(c.date)}
                  className={`min-h-16 rounded-md border p-1 text-left ${
                    weekend ? "bg-muted/40" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {c.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 2).map((r) => (
                      <div
                        key={r.id}
                        title={`${r.user_name ?? "Collaborateur"} — ${r.type_name} (${LEAVE_STATUS_LABELS[r.status]})`}
                        className={`truncate rounded px-1 text-[10px] ${
                          r.status === "approved"
                            ? "bg-primary/15 text-primary"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {(r.user_name ?? "Collaborateur").split(" ")[0]}
                      </div>
                    ))}
                    {items.length > 2 && (
                      <div className="px-1 text-[10px] text-muted-foreground">
                        +{items.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="bg-primary/15 text-primary">
              Validée
            </Badge>
            <Badge
              variant="secondary"
              className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
            >
              En attente
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
