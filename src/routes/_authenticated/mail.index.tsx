import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  CalendarClock,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  Paperclip,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { mailStatus, syncMailAccounts } from "@/lib/mail/mail.functions";
import { mailDashboardStats } from "@/lib/mail/stats.functions";
import { PROVIDER_LABELS } from "@/lib/mail/types";
import { AddMailAccountDialog } from "@/components/mail/AddMailAccountDialog";
import { ComposeMailDialog } from "@/components/mail/ComposeMailDialog";

export const Route = createFileRoute("/_authenticated/mail/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord messagerie — DailyBrief" },
      {
        name: "description",
        content:
          "Suivez l'activité de vos comptes e-mail connectés : non-lus, envois, pièces jointes, envois programmés et performance.",
      },
      { property: "og:title", content: "Tableau de bord messagerie — DailyBrief" },
      {
        property: "og:description",
        content:
          "Statistiques clés de vos boîtes e-mail : messages reçus, envois, échecs et programmations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailDashboard,
});

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 160 60% 45%))",
  "hsl(var(--chart-4, 30 80% 55%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Mail;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MailDashboard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(mailStatus);
  const statsFn = useServerFn(mailDashboardStats);
  const syncFn = useServerFn(syncMailAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data } = useQuery({ queryKey: ["mail", "status"], queryFn: () => statusFn() });
  const { data: stats, isLoading } = useQuery({
    queryKey: ["mail", "stats"],
    queryFn: () => statsFn(),
  });

  const sync = useMutation({
    mutationFn: (accountId: string | null) => syncFn({ data: { accountId } }),
    onSuccess: (r: any) => {
      if (r?.errors?.length) r.errors.forEach((e: string) => toast.error(e));
      else toast.success("Synchronisation terminée.");
      qc.invalidateQueries({ queryKey: ["mail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accounts = data?.accounts ?? [];
  const inError = (stats?.accounts ?? []).filter((a) => a.status === "error");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Mail className="h-6 w-6 text-primary" /> Tableau de bord messagerie
          </h1>
          <p className="text-sm text-muted-foreground">
            Activité de vos comptes connectés et performance de vos envois.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => sync.mutate(null)}
            disabled={sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Synchroniser
          </Button>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter un compte
          </Button>
          <Button onClick={() => setComposeOpen(true)} disabled={accounts.length === 0}>
            <MailCheck className="mr-2 h-4 w-4" /> Rédiger
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/mail/inbox">
              <Inbox className="mr-2 h-4 w-4" /> Boîte unifiée
            </Link>
          </Button>
        </div>
      </div>

      {data && !data.gatewayReady && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Relais de messagerie à activer</AlertTitle>
          <AlertDescription>
            L'interface est complète ; la relève des messages IMAP/SMTP démarre dès que la
            clé d'accès du relais de messagerie est enregistrée.
          </AlertDescription>
        </Alert>
      )}

      {inError.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Comptes à reconnecter</AlertTitle>
          <AlertDescription>
            {inError
              .map((a) => `${a.email} : ${a.status_message ?? "connexion échouée"}`)
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Messages non lus"
          value={stats?.unreadTotal ?? 0}
          hint={`${stats?.accounts.length ?? 0} compte(s) connecté(s)`}
          icon={Inbox}
        />
        <StatCard
          label="Envoyés (7 j)"
          value={stats?.sent7 ?? 0}
          hint={`${stats?.sent30 ?? 0} sur 30 jours`}
          icon={MailCheck}
        />
        <StatCard
          label="Envois programmés"
          value={stats?.scheduledPending ?? 0}
          hint={`${stats?.scheduledFailed ?? 0} en échec`}
          icon={CalendarClock}
        />
        <StatCard
          label="Pièces jointes envoyées"
          value={stats?.attachmentsSent30 ?? 0}
          hint="via envois programmés (30 j)"
          icon={Paperclip}
        />
      </div>

      <Card>

          <CardHeader>
            <CardTitle className="text-base">Non-lus par compte</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {(stats?.unreadByAccount ?? []).every((u) => u.unread === 0) ? (
              <p className="text-sm text-muted-foreground">Aucun message non lu.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.unreadByAccount ?? []}
                    dataKey="unread"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                  >
                    {(stats?.unreadByAccount ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(stats?.recent.length ?? 0) === 0 && (
            <p className="text-muted-foreground">Aucun évènement pour le moment.</p>
          )}
          {(stats?.recent ?? []).map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0"
            >
              <Badge variant={l.status === "success" ? "outline" : "destructive"}>
                {l.status === "success" ? "OK" : "Erreur"}
              </Badge>
              <span className="font-mono text-xs">{l.action}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString("fr-FR")}
              </span>
              {l.error_message && (
                <span className="text-xs text-destructive">{l.error_message}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AddMailAccountDialog open={addOpen} onOpenChange={setAddOpen} />
      <ComposeMailDialog open={composeOpen} onOpenChange={setComposeOpen} accounts={accounts} />
    </div>
  );
}
