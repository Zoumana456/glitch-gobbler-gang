import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, Clock, Loader2, Mail, Send, Trash2, X } from "lucide-react";
import {
  cancelScheduledMail,
  deleteScheduledMail,
  listScheduledMails,
  rescheduleMailMessage,
  sendScheduledMailNow,
  type ScheduledMailRow,
} from "@/lib/mail/scheduling.functions";
import { mailStatus } from "@/lib/mail/mail.functions";
import { ComposeMailDialog } from "@/components/mail/ComposeMailDialog";

export const Route = createFileRoute("/_authenticated/mail/scheduled")({
  head: () => ({
    meta: [
      { title: "Envois programmés — DailyBrief" },
      {
        name: "description",
        content:
          "Planifiez vos e-mails à l'heure de votre choix et suivez les envois en attente, réussis ou en échec.",
      },
      { property: "og:title", content: "Envois programmés — DailyBrief" },
      {
        property: "og:description",
        content: "Programmation d'e-mails, modification de l'heure, envoi immédiat et annulation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScheduledPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  sending: "Envoi en cours",
  sent: "Envoyé",
  failed: "Échec",
  canceled: "Annulé",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduledPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listScheduledMails);
  const statusFn = useServerFn(mailStatus);
  const cancelFn = useServerFn(cancelScheduledMail);
  const deleteFn = useServerFn(deleteScheduledMail);
  const sendNowFn = useServerFn(sendScheduledMailNow);
  const rescheduleFn = useServerFn(rescheduleMailMessage);

  const [tab, setTab] = useState("pending");
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledMailRow | null>(null);
  const [editDate, setEditDate] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["mail", "scheduled"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const { data: status } = useQuery({ queryKey: ["mail", "status"], queryFn: () => statusFn() });
  const accounts = status?.accounts ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["mail"] });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Envoi annulé.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Programmation supprimée.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendNow = useMutation({
    mutationFn: (id: string) => sendNowFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Message envoyé.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reschedule = useMutation({
    mutationFn: (input: { id: string; scheduledAt: string }) => rescheduleFn({ data: input }),
    onSuccess: () => {
      toast.success("Nouvelle heure enregistrée.");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? a.email : "Compte supprimé";
  };

  const filtered = items.filter((i) => {
    if (tab === "pending") return i.status === "pending" || i.status === "sending";
    if (tab === "sent") return i.status === "sent";
    if (tab === "failed") return i.status === "failed" || i.status === "canceled";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarClock className="h-6 w-6 text-primary" /> Envois programmés
          </h1>
          <p className="text-sm text-muted-foreground">
            Les messages partent automatiquement à l'heure choisie (vérification toutes les 5
            minutes).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/mail">
              <Mail className="mr-2 h-4 w-4" /> Tableau de bord
            </Link>
          </Button>
          <Button onClick={() => setComposeOpen(true)} disabled={accounts.length === 0}>
            <Clock className="mr-2 h-4 w-4" /> Programmer un envoi
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            En attente ({items.filter((i) => i.status === "pending" || i.status === "sending").length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Envoyés ({items.filter((i) => i.status === "sent").length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Échecs / annulés (
            {items.filter((i) => i.status === "failed" || i.status === "canceled").length})
          </TabsTrigger>
          <TabsTrigger value="all">Tout ({items.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucun envoi dans cette catégorie.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{m.subject || "(sans objet)"}</CardTitle>
                <p className="truncate text-xs text-muted-foreground">
                  {accountLabel(m.account_id)} → {m.to_recipients}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    m.status === "sent"
                      ? "default"
                      : m.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {STATUS_LABELS[m.status] ?? m.status}
                </Badge>
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  {new Date(m.scheduled_at).toLocaleString("fr-FR")}
                </Badge>
                {m.attachments.length > 0 && (
                  <Badge variant="outline">{m.attachments.length} pièce(s) jointe(s)</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {m.last_error && (
                <p className="text-xs text-destructive">
                  Dernière erreur : {m.last_error} ({m.attempts} tentative(s))
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(m.status === "pending" || m.status === "failed" || m.status === "canceled") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(m);
                      setEditDate(toLocalInput(m.scheduled_at));
                    }}
                  >
                    <Clock className="mr-2 h-3.5 w-3.5" /> Modifier l'heure
                  </Button>
                )}
                {(m.status === "pending" || m.status === "failed") && (
                  <Button
                    size="sm"
                    onClick={() => sendNow.mutate(m.id)}
                    disabled={sendNow.isPending}
                  >
                    {sendNow.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-3.5 w-3.5" />
                    )}
                    Envoyer maintenant
                  </Button>
                )}
                {m.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(m.id)}>
                    <X className="mr-2 h-3.5 w-3.5" /> Annuler
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette programmation ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le message ne sera pas envoyé et sera définitivement retiré de la liste.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(m.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'heure d'envoi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date et heure</Label>
            <Input
              id="edit-date"
              type="datetime-local"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                editing &&
                reschedule.mutate({
                  id: editing.id,
                  scheduledAt: new Date(editDate).toISOString(),
                })
              }
              disabled={!editDate || reschedule.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComposeMailDialog open={composeOpen} onOpenChange={setComposeOpen} accounts={accounts} />
    </div>
  );
}
