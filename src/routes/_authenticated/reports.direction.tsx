import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDirectionKpis } from "@/lib/hierarchy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BarChart3, ShieldAlert } from "lucide-react";
import { levelLabel } from "@/lib/reports.types";

export const Route = createFileRoute("/_authenticated/reports/direction")({
  head: () => ({
    meta: [
      { title: "Vue direction — DailyBrief" },
      {
        name: "description",
        content:
          "Indicateurs consolidés de remise et de validation des rapports par département et par niveau hiérarchique.",
      },
      { property: "og:title", content: "Vue direction — DailyBrief" },
      {
        property: "og:description",
        content: "KPIs de conformité des rapports par département et par niveau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectionPage,
});

function DirectionPage() {
  const fetchFn = useServerFn(getDirectionKpis);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const query = useQuery({
    queryKey: ["direction-kpis", from, to],
    queryFn: () => fetchFn({ data: { from, to } }),
    retry: false,
  });

  if (query.isError) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {(query.error as any)?.message ?? "Vue réservée à la direction."}
            </p>
            <Button variant="outline" asChild>
              <Link to="/reports">Retour aux rapports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const k = query.data;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Vue direction</h1>
        <p className="text-muted-foreground mt-1">
          Conformité de remise et validation des rapports sur la période choisie.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Du</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Au</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {query.isLoading || !k ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Collaborateurs" value={k.head_count} />
            <Kpi label="Rapports soumis" value={k.submitted} hint={`sur ${k.expected} attendus`} />
            <Kpi label="Validés" value={k.approved} />
            <Kpi
              label="Taux de conformité"
              value={`${k.compliance_rate}%`}
              hint={
                k.avg_approval_hours !== null
                  ? `Validation moyenne : ${k.avg_approval_hours} h`
                  : undefined
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="En attente de validation" value={k.pending} />
            <Kpi label="À corriger" value={k.rejected} />
            <Kpi label="Période" value={`${k.from} → ${k.to}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Par département
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {k.by_department.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune donnée.</p>
              )}
              {k.by_department
                .sort((a, b) => b.compliance_rate - a.compliance_rate)
                .map((d) => (
                  <div key={d.department} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.department}</span>
                      <span className="text-muted-foreground">
                        {d.submitted} soumis · {d.approved} validés · {d.pending} en attente ·{" "}
                        {d.head_count} pers.
                      </span>
                    </div>
                    <Progress value={Math.min(d.compliance_rate, 100)} />
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Par niveau hiérarchique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {k.by_level
                .sort((a, b) => a.level - b.level)
                .map((l) => (
                  <div
                    key={l.level}
                    className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{levelLabel(l.level)}</span>
                    <span className="text-muted-foreground">
                      {l.head_count} pers. · {l.submitted} soumis · {l.approved} validés
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
