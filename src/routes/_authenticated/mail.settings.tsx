import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, Settings2, Star, Trash2 } from "lucide-react";
import {
  deleteMailAccount,
  listMailLogs,
  mailStatus,
  syncMailAccounts,
  updateMailAccount,
} from "@/lib/mail/mail.functions";
import { PROVIDER_LABELS } from "@/lib/mail/types";
import { AddMailAccountDialog } from "@/components/mail/AddMailAccountDialog";
import { MailTemplatesPanel } from "@/components/mail/MailTemplatesPanel";
import { MailSignaturesPanel } from "@/components/mail/MailSignaturesPanel";

export const Route = createFileRoute("/_authenticated/mail/settings")({
  head: () => ({
    meta: [
      { title: "Comptes e-mail & paramètres — DailyBrief" },
      {
        name: "description",
        content:
          "Gérez vos comptes e-mail connectés, signatures, compte principal et synchronisation.",
      },
      { property: "og:title", content: "Comptes e-mail & paramètres — DailyBrief" },
      {
        property: "og:description",
        content: "Connexion, signatures et synchronisation de vos boîtes e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailSettings,
});

function MailSettings() {
  const qc = useQueryClient();
  const statusFn = useServerFn(mailStatus);
  const updateFn = useServerFn(updateMailAccount);
  const deleteFn = useServerFn(deleteMailAccount);
  const syncFn = useServerFn(syncMailAccounts);
  const [addOpen, setAddOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { signature: string; label: string }>>({});

  const { data } = useQuery({ queryKey: ["mail", "status"], queryFn: () => statusFn() });
  const accounts = data?.accounts ?? [];

  type UpdateInput = {
    id: string;
    label?: string | null;
    signature?: string | null;
    signatureMode?: "auto" | "manual" | "none";
    isPrimary?: boolean;
    status?: "connected" | "disabled";
  };
  const update = useMutation({
    mutationFn: (input: UpdateInput) => updateFn({ data: input }),

    onSuccess: () => {
      toast.success("Paramètres enregistrés.");
      qc.invalidateQueries({ queryKey: ["mail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Compte déconnecté.");
      qc.invalidateQueries({ queryKey: ["mail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (id: string) => syncFn({ data: { accountId: id } }),
    onSuccess: () => {
      toast.success("Compte synchronisé.");
      qc.invalidateQueries({ queryKey: ["mail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings2 className="h-6 w-6 text-primary" /> Comptes & paramètres
          </h1>
          <p className="text-sm text-muted-foreground">
            Identifiants chiffrés, signatures, compte principal et relève manuelle.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter un compte
        </Button>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Comptes</TabsTrigger>
          <TabsTrigger value="templates">Modèles</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="logs">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <MailTemplatesPanel />
        </TabsContent>

        <TabsContent value="signatures">
          <MailSignaturesPanel accounts={accounts} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-1 text-sm">
          {logs.length === 0 && (
            <p className="text-muted-foreground">Aucun évènement pour le moment.</p>
          )}
          {logs.map((l: any) => (
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
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
      {accounts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucun compte connecté pour l'instant.
          </CardContent>
        </Card>
      )}

      {accounts.map((a) => {
        const d = drafts[a.id] ?? {
          signature: a.signature ?? "",
          label: a.label ?? "",
        };
        return (
          <Card key={a.id}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{a.email}</CardTitle>
                <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[a.provider]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.is_primary ? (
                  <Badge variant="secondary">
                    <Star className="mr-1 h-3 w-3" /> Principal
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: a.id, isPrimary: true })}
                  >
                    Définir comme principal
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sync.mutate(a.id)}
                  disabled={sync.isPending}
                >
                  {sync.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Synchroniser
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Déconnecter ${a.email}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Déconnecter ce compte ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Les identifiants chiffrés seront supprimés. Vos e-mails restent
                        intacts chez votre fournisseur.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(a.id)}>
                        Déconnecter
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`label-${a.id}`}>Étiquette</Label>
                  <Input
                    id={`label-${a.id}`}
                    value={d.label}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [a.id]: { ...d, label: e.target.value } }))
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Compte actif</p>
                    <p className="text-xs text-muted-foreground">
                      Désactivé, ce compte est exclu de la boîte unifiée.
                    </p>
                  </div>
                  <Switch
                    checked={a.status !== "disabled"}
                    aria-label="Activer le compte"
                    onCheckedChange={(v) =>
                      update.mutate({ id: a.id, status: v ? "connected" : "disabled" })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`sig-${a.id}`}>Signature</Label>
                <Textarea
                  id={`sig-${a.id}`}
                  rows={4}
                  value={d.signature}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [a.id]: { ...d, signature: e.target.value } }))
                  }
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        id: a.id,
                        label: d.label || null,
                        signature: d.signature || null,
                        signatureMode: d.signature ? "auto" : "none",
                      })
                    }
                    disabled={update.isPending}
                  >
                    Enregistrer
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Insertion automatique :{" "}
                    {a.signature_mode === "auto" ? "activée" : "désactivée"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AddMailAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
