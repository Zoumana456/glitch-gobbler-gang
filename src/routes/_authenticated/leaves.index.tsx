import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck2, CalendarDays, Plus, Users } from "lucide-react";
import { leavesOverview } from "@/lib/leaves/leaves.functions";
import { LeaveRequestRow } from "@/components/leaves/LeaveRequestRow";
import { formatLeaveRange } from "@/lib/leaves/types";

export const Route = createFileRoute("/_authenticated/leaves/")({
  head: () => ({
    meta: [
      { title: "Congés & absences — DailyBrief" },
      {
        name: "description",
        content:
          "Demandez vos congés, suivez vos soldes et consultez les absences de votre équipe.",
      },
      { property: "og:title", content: "Congés & absences — DailyBrief" },
      {
        property: "og:description",
        content: "Demandes de congés, soldes et validations hiérarchiques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const overviewFn = useServerFn(leavesOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaves", "overview"],
    queryFn: () => overviewFn(),
  });

  const balances = data?.balances ?? [];
  const mine = data?.mine ?? [];
  const team = data?.team ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="grid grid-cols-1 gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold sm:text-2xl">
            <CalendarCheck2 className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">Congés & absences</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Vos demandes, vos soldes et les absences de votre équipe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data?.pendingCount ?? 0) > 0 && (
            <Button asChild variant="outline">
              <Link to="/leaves/validations">
                À valider
                <Badge className="ml-2" variant="secondary">
                  {data?.pendingCount}
                </Badge>
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/leaves/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle demande
            </Link>
          </Button>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {(error as any)?.message ?? "Erreur de chargement"}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {balances.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {balances.map((b) => (
            <Card key={b.type_id}>
              <CardContent className="space-y-1 p-4">
                <p className="text-sm text-muted-foreground">{b.type_name}</p>
                <p className="text-2xl font-semibold">
                  {Math.max(0, b.allocated_days - b.used_days)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    j restants
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.used_days} / {b.allocated_days} j utilisés en {b.year}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mes demandes
        </h2>
        {!isLoading && mine.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aucune demande d'absence pour le moment.
              </p>
              <Button asChild size="sm">
                <Link to="/leaves/new">Créer ma première demande</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {mine.map((r) => (
              <LeaveRequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Absences à venir dans l'entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Personne n'est absent dans les prochains jours.
            </p>
          ) : (
            team.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">{r.user_name || "Collaborateur"}</span>
                <span className="text-muted-foreground">
                  {r.type_name} · {formatLeaveRange(r.start_date, r.end_date)}
                </span>
              </div>
            ))
          )}
          <Button asChild variant="ghost" size="sm" className="px-0">
            <Link to="/leaves/calendrier">Voir le calendrier d'équipe</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
