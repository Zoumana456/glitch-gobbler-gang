import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Inbox,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { mailStatus, syncMailAccounts, listMailLogs } from "@/lib/mail/mail.functions";
import { PROVIDER_LABELS } from "@/lib/mail/types";
import { AddMailAccountDialog } from "@/components/mail/AddMailAccountDialog";
import { ComposeMailDialog } from "@/components/mail/ComposeMailDialog";

export const Route = createFileRoute("/_authenticated/mail/")({
  head: () => ({
    meta: [
      { title: "Messagerie unifiée — DailyBrief" },
      {
        name: "description",
        content:
          "Centralisez Gmail, Outlook, Yahoo et vos boîtes professionnelles dans une messagerie unique intégrée à DailyBrief.",
      },
      { property: "og:title", content: "Messagerie unifiée — DailyBrief" },
      {
        property: "og:description",
        content:
          "Tous vos comptes e-mail dans une seule boîte : lecture, envoi, recherche et dossiers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailDashboard,
});

function MailDashboard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(mailStatus);
  const syncFn = useServerFn(syncMailAccounts);
  const logsFn = useServerFn(listMailLogs);
  const [addOpen, setAddOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["mail", "status"],
    queryFn: () => statusFn(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["mail", "logs"],
    queryFn: () => logsFn(),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: {} }),
    onSuccess: (r) => {
      if (r.errors.length) r.errors.forEach((e) => toast.error(e));
      else toast.success("Comptes synchronisés.");
      qc.invalidateQueries({ queryKey: ["mail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accounts = data?.accounts ?? [];
  const unread = accounts.reduce((s, a) => s + (a.unread_count ?? 0), 0);
  const inError = accounts.filter((a) => a.status === "error");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Mail className="h-6 w-6 text-primary" /> Messagerie unifiée
          </h1>
          <p className="text-sm text-muted-foreground">
            Tous vos comptes e-mail dans une seule interface, sans quitter DailyBrief.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
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
          <Button asChild>
            <Link to="/mail/inbox">
              <Inbox className="mr-2 h-4 w-4" /> Ouvrir la boîte unifiée
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
            clé d'accès du relais de messagerie est enregistrée dans les paramètres du
            projet.
          </AlertDescription>
        </Alert>
      )}

      {inError.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Comptes à reconnecter</AlertTitle>
          <AlertDescription>
            {inError.map((a) => `${a.email} : ${a.status_message ?? "connexion échouée"}`).join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comptes connectés</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{accounts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Messages non lus</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{unread}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Nouveau message</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => setComposeOpen(true)}
              disabled={accounts.length === 0}
            >
              Rédiger
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Comptes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/mail/settings">
              <Settings2 className="mr-2 h-4 w-4" /> Paramètres
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!isLoading && accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun compte connecté. Ajoutez Gmail, Outlook, Yahoo ou une boîte
              professionnelle pour commencer.
            </p>
          )}
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {PROVIDER_LABELS[a.provider]}
                  {a.label ? ` · ${a.label}` : ""}
                  {a.last_sync_at
                    ? ` · dernière relève ${new Date(a.last_sync_at).toLocaleString("fr-FR")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.is_primary && <Badge variant="secondary">Principal</Badge>}
                <Badge variant={a.status === "connected" ? "default" : "destructive"}>
                  {a.status === "connected" ? "Connecté" : "À vérifier"}
                </Badge>
                <Badge variant="outline">{a.unread_count} non lus</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal de synchronisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {logs.length === 0 && (
            <p className="text-muted-foreground">Aucun évènement pour le moment.</p>
          )}
          {logs.slice(0, 12).map((l: any) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 border-b py-1 last:border-0">
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
      <ComposeMailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        accounts={accounts}
      />
    </div>
  );
}
