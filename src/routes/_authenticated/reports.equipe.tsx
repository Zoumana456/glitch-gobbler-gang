import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listPendingApprovals,
  listConsolidationCandidates,
  createConsolidatedReport,
  approveReport,
} from "@/lib/approvals.functions";
import { getTeamCompliance } from "@/lib/hierarchy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Check, Layers, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatLongDate } from "@/lib/date-utils";
import { levelLabel } from "@/lib/reports.types";

export const Route = createFileRoute("/_authenticated/reports/equipe")({
  head: () => ({
    meta: [
      { title: "Mon équipe — validations DailyBrief" },
      {
        name: "description",
        content:
          "Validez les rapports de votre équipe, suivez la remise quotidienne et créez des synthèses consolidées.",
      },
      { property: "og:title", content: "Mon équipe — validations DailyBrief" },
      {
        property: "og:description",
        content: "File d'attente de validation, suivi de remise et synthèses d'équipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mon équipe</h1>
        <p className="text-muted-foreground mt-1">
          Validations en attente, suivi de remise et synthèses consolidées.
        </p>
      </header>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">À valider</TabsTrigger>
          <TabsTrigger value="compliance">Suivi de remise</TabsTrigger>
          <TabsTrigger value="consolidate">Synthèse</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <PendingPanel />
        </TabsContent>
        <TabsContent value="compliance" className="mt-4">
          <CompliancePanel />
        </TabsContent>
        <TabsContent value="consolidate" className="mt-4">
          <ConsolidatePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendingPanel() {
  const fetchFn = useServerFn(listPendingApprovals);
  const approveFn = useServerFn(approveReport);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["pending-approvals"], queryFn: () => fetchFn() });

  const approveMut = useMutation({
    mutationFn: (reportId: string) => approveFn({ data: { reportId } }),
    onSuccess: () => {
      toast.success("Rapport validé");
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Validation impossible"),
  });

  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = query.data ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Aucun rapport en attente de votre validation.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.report_id}>
          <CardContent className="py-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                {r.author_name}
                {r.author_position ? ` · ${r.author_position}` : ""} ·{" "}
                {formatLongDate(r.report_date)}
              </div>
            </div>
            {r.kind === "consolidated" && <Badge variant="secondary">Synthèse</Badge>}
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports/$id" params={{ id: r.report_id }}>
                Ouvrir
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => approveMut.mutate(r.report_id)}
              disabled={approveMut.isPending}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Valider
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompliancePanel() {
  const fetchFn = useServerFn(getTeamCompliance);
  const query = useQuery({
    queryKey: ["team-compliance"],
    queryFn: () => fetchFn({ data: {} }),
  });

  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  const rows = query.data ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            Aucun collaborateur rattaché à vous. Définissez les rattachements dans l'organigramme.
          </p>
          <Button variant="outline" asChild>
            <Link to="/company/hierarchie">Ouvrir l'organigramme</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rapport du jour</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {levelLabel(m.hierarchy_level)}
                {m.position_title ? ` · ${m.position_title}` : ""}
              </div>
            </div>
            {m.today_state === "none" ? (
              <Badge variant="outline" className="text-muted-foreground">
                Non remis
              </Badge>
            ) : m.today_state === "approved" ? (
              <Badge>Validé</Badge>
            ) : m.today_state === "rejected" ? (
              <Badge variant="destructive">À corriger</Badge>
            ) : (
              <Badge variant="secondary">En cours</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {m.days_since_last_report === null
                ? "Jamais de rapport"
                : m.days_since_last_report === 0
                  ? "Dernier rapport aujourd'hui"
                  : `Dernier rapport il y a ${m.days_since_last_report} j`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConsolidatePanel() {
  const navigate = useNavigate();
  const listFn = useServerFn(listConsolidationCandidates);
  const createFn = useServerFn(createConsolidatedReport);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["consolidation-candidates", from, to],
    queryFn: () => listFn({ data: { from, to } }),
  });

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title: title.trim() || `Synthèse du ${from} au ${to}`,
          from,
          to,
          reportIds: selected,
        },
      }),
    onSuccess: (r: any) => {
      toast.success("Synthèse créée");
      navigate({ to: "/reports/$id/edit", params: { id: r.reportId } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Création impossible"),
  });

  const rows = query.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Créer une synthèse d'équipe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Au</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Titre</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Synthèse du ${from} au ${to}`}
            />
          </div>
        </div>

        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun rapport d'équipe sur cette période.
          </p>
        ) : (
          <div className="space-y-1">
            {rows.map((r) => (
              <label
                key={r.report_id}
                className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(r.report_id)}
                  onCheckedChange={(v) =>
                    setSelected((s) =>
                      v ? [...s, r.report_id] : s.filter((x) => x !== r.report_id),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.author_name} · {formatLongDate(r.report_date)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <Button onClick={() => mut.mutate()} disabled={mut.isPending || selected.length === 0}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Générer la synthèse ({selected.length})
        </Button>
      </CardContent>
    </Card>
  );
}
