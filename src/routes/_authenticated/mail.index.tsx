import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Volume envoyé (14 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.sentByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v: string) => v.slice(5)}
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" name="Envoyés" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Échecs" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance des envois (30 j)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taux de réussite</span>
                <span className="font-semibold">{stats?.successRate ?? 100}%</span>
              </div>
              <Progress value={stats?.successRate ?? 100} className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Réussis</p>
                <p className="text-lg font-semibold">{stats?.sent30 ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Échecs</p>
                <p className="text-lg font-semibold text-destructive">
                  {stats?.sendFailures30 ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Erreurs de relève (7 j)</p>
                <p className="text-lg font-semibold">{stats?.syncErrors7 ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Modèles / signatures</p>
                <p className="text-lg font-semibold">
                  {stats?.templates ?? 0} / {stats?.signatures ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Santé des comptes</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/mail/scheduled">
                  <CalendarClock className="mr-2 h-4 w-4" /> Envois programmés
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/mail/settings">
                  <Settings2 className="mr-2 h-4 w-4" /> Paramètres
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats?.accounts.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun compte connecté. Ajoutez Gmail, Outlook, Yahoo ou une boîte
                professionnelle pour commencer.
              </p>
            )}
            {(stats?.accounts ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PROVIDER_LABELS[a.provider as keyof typeof PROVIDER_LABELS] ?? a.provider}
                    {a.label ? ` · ${a.label}` : ""}
                    {a.last_sync_at
                      ? ` · dernière relève ${new Date(a.last_sync_at).toLocaleString("fr-FR")}`
                      : " · jamais relevé"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.is_primary && <Badge variant="secondary">Principal</Badge>}
                  <Badge variant={a.status === "connected" ? "default" : "destructive"}>
                    {a.status === "connected" ? "Connecté" : "À vérifier"}
                  </Badge>
                  <Badge variant="outline">{a.unread_count} non lus</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sync.mutate(a.id)}
                    disabled={sync.isPending}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Relever
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

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
      </div>

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
