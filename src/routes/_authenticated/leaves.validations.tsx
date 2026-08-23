import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { listPendingLeaves } from "@/lib/leaves/leaves.functions";
import { LeaveRequestRow } from "@/components/leaves/LeaveRequestRow";

export const Route = createFileRoute("/_authenticated/leaves/validations")({
  head: () => ({
    meta: [
      { title: "Absences à valider — DailyBrief" },
      {
        name: "description",
        content:
          "Validez ou refusez les demandes d'absence de vos collaborateurs directs.",
      },
      { property: "og:title", content: "Absences à valider — DailyBrief" },
      {
        property: "og:description",
        content: "Traitez les demandes de congés de votre équipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaveApprovalsPage,
});

function LeaveApprovalsPage() {
  const listFn = useServerFn(listPendingLeaves);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["leaves", "pending"],
    queryFn: () => listFn(),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/leaves">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux congés
        </Link>
      </Button>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Absences à valider
        </h1>
        <p className="text-sm text-muted-foreground">
          Demandes en attente de votre décision.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {(error as any)?.message ?? "Erreur de chargement"}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading && data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aucune demande en attente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <LeaveRequestRow key={r.id} request={r} showOwner />
          ))}
        </div>
      )}
    </div>
  );
}
