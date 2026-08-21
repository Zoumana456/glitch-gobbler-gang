import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Archive,
  ArrowLeft,
  CornerUpLeft,
  Download,
  Forward,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  Pen,
  RefreshCw,
  Search,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  deleteMailMessage,
  downloadMailAttachment,
  flagMailMessage,
  getMailMessage,
  listMailMessages,
  mailStatus,
  moveMailMessage,
  syncMailAccounts,
} from "@/lib/mail/mail.functions";
import {
  FOLDER_LABELS,
  FOLDER_ORDER,
  PROVIDER_LABELS,
  addressLabel,
  formatBytes,
  type MailFolderKind,
} from "@/lib/mail/types";
import { ComposeMailDialog, type ComposeSeed } from "@/components/mail/ComposeMailDialog";

export const Route = createFileRoute("/_authenticated/mail/inbox")({
  head: () => ({
    meta: [
      { title: "Boîte unifiée — DailyBrief" },
      {
        name: "description",
        content:
          "Lisez, répondez, classez et recherchez tous vos e-mails multi-comptes depuis une boîte unifiée.",
      },
      { property: "og:title", content: "Boîte unifiée — DailyBrief" },
      {
        property: "og:description",
        content: "Une seule boîte pour Gmail, Outlook, Yahoo et vos comptes professionnels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnifiedInbox,
});

function UnifiedInbox() {
  const qc = useQueryClient();
  const statusFn = useServerFn(mailStatus);
  const listFn = useServerFn(listMailMessages);
  const getFn = useServerFn(getMailMessage);
  const flagFn = useServerFn(flagMailMessage);
  const moveFn = useServerFn(moveMailMessage);
  const delFn = useServerFn(deleteMailMessage);
  const attFn = useServerFn(downloadMailAttachment);
  const syncFn = useServerFn(syncMailAccounts);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [folder, setFolder] = useState<MailFolderKind>("inbox");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [withAttachments, setWithAttachments] = useState(false);
  const [selected, setSelected] = useState<{ accountId: string; messageId: string } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [seed, setSeed] = useState<ComposeSeed | undefined>();

  const { data: status } = useQuery({ queryKey: ["mail", "status"], queryFn: () => statusFn() });
  const accounts = status?.accounts ?? [];

  const filters = useMemo(
    () => ({
      accountId,
      folder,
      search: applied || undefined,
      unreadOnly,
      withAttachments,
    }),
    [accountId, folder, applied, unreadOnly, withAttachments],
  );

  const {
    data: listing,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["mail", "messages", filters],
    queryFn: () => listFn({ data: filters }),
    enabled: accounts.length > 0,
  });

  const { data: message, isLoading: loadingMessage } = useQuery({
    queryKey: ["mail", "message", selected?.accountId, selected?.messageId],
    queryFn: () => getFn({ data: selected! }),
    enabled: !!selected,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mail"] });

  const flag = useMutation({
    mutationFn: (v: { messageId: string; accountId: string; read?: boolean; starred?: boolean }) =>
      flagFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (v: { messageId: string; accountId: string; folder: MailFolderKind }) =>
      moveFn({ data: v }),
    onSuccess: () => {
      toast.success("Message déplacé.");
      setSelected(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (v: { messageId: string; accountId: string }) => delFn({ data: v }),
    onSuccess: () => {
      toast.success("Message supprimé.");
      setSelected(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { accountId } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(attachmentId: string, filename: string) {
    if (!selected) return;
    try {
      const res = await attFn({ data: { accountId: selected.accountId, attachmentId } });
      const link = document.createElement("a");
      link.href = `data:${res.mimeType};base64,${res.base64}`;
      link.download = filename;
      link.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    }
  }

  const messages = listing?.messages ?? [];

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium">Aucun compte e-mail connecté.</p>
          <p className="text-muted-foreground">
            Ajoutez un compte dans les paramètres de la messagerie pour afficher votre boîte
            unifiée.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Inbox className="h-5 w-5 text-primary" /> Boîte unifiée
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setApplied(search.trim())}
              placeholder="Rechercher (objet, expéditeur, contenu)"
              className="sm:w-72"
              aria-label="Rechercher dans les e-mails"
            />
            <Button variant="outline" onClick={() => setApplied(search.trim())} aria-label="Lancer la recherche">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Relever
          </Button>
          <Button
            onClick={() => {
              setSeed(undefined);
              setComposeOpen(true);
            }}
          >
            <Pen className="mr-2 h-4 w-4" /> Rédiger
          </Button>
        </div>
      </div>

      {(listing?.errors?.length ?? 0) > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>{listing!.errors.join(" · ")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[200px_180px_minmax(0,1fr)] xl:grid-cols-[220px_320px_minmax(0,1fr)]">
        {/* Colonne 1 : comptes */}
        <Card className="h-fit">
          <CardContent className="space-y-1 p-2">
            <p className="px-2 pt-1 text-xs font-medium uppercase text-muted-foreground">
              Comptes
            </p>
            <button
              type="button"
              onClick={() => setAccountId(null)}
              className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                accountId === null ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              Tous les comptes
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                  accountId === a.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <span className="block truncate">{a.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {PROVIDER_LABELS[a.provider]}
                </span>
              </button>
            ))}
            <Separator className="my-2" />
            <p className="px-2 text-xs font-medium uppercase text-muted-foreground">Dossiers</p>
            {FOLDER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFolder(f);
                  setSelected(null);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  folder === f ? "bg-muted font-medium" : "hover:bg-muted"
                }`}
              >
                {FOLDER_LABELS[f]}
              </button>
            ))}
            <Separator className="my-2" />
            <div className="space-y-2 px-2 pb-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                Non lus seulement
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={withAttachments}
                  onChange={(e) => setWithAttachments(e.target.checked)}
                />
                Avec pièce jointe
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Colonne 2 : liste */}
        <Card className="min-w-0">
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh]">
              {(isLoading || isFetching) && (
                <p className="p-4 text-sm text-muted-foreground">Chargement des messages…</p>
              )}
              {!isLoading && messages.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Aucun message dans « {FOLDER_LABELS[folder]} ».
                </p>
              )}
              {messages.map((m) => (
                <button
                  key={`${m.accountId}-${m.id}`}
                  type="button"
                  onClick={() => setSelected({ accountId: m.accountId, messageId: m.id })}
                  className={`w-full border-b p-3 text-left transition hover:bg-muted ${
                    selected?.messageId === m.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${m.unread ? "font-semibold" : ""}`}>
                      {addressLabel(m.from)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className={`truncate text-sm ${m.unread ? "font-medium" : ""}`}>{m.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.snippet}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {accountId === null && (
                      <Badge variant="outline" className="text-[10px]">
                        {m.accountEmail}
                      </Badge>
                    )}
                    {m.starred && <Star className="h-3 w-3 text-amber-500" />}
                    {m.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                    {m.unread && <Badge className="text-[10px]">Non lu</Badge>}
                  </div>
                </button>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonne 3 : lecture */}
        <Card className="min-w-0">
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh]">
              {!selected && (
                <div className="p-6 text-sm text-muted-foreground">
                  Sélectionnez un message pour l'afficher.
                </div>
              )}
              {selected && loadingMessage && (
                <div className="p-6 text-sm text-muted-foreground">Ouverture du message…</div>
              )}
              {selected && message && (
                <div className="space-y-4 p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                  </Button>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{message.subject}</h2>
                    <p className="text-sm text-muted-foreground">
                      De {addressLabel(message.from)} · {new Date(message.date).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      À {message.to.map(addressLabel).join(", ") || "—"}
                      {message.cc.length ? ` · Cc ${message.cc.map(addressLabel).join(", ")}` : ""}
                    </p>
                    <Badge variant="outline">{message.accountEmail}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSeed({
                          accountId: message.accountId,
                          to: message.from?.address ?? "",
                          subject: `Re : ${message.subject}`,
                          body: `\n\n---\n${message.text ?? ""}`,
                          replyTo: message.id,
                        });
                        setComposeOpen(true);
                      }}
                    >
                      <CornerUpLeft className="mr-2 h-4 w-4" /> Répondre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSeed({
                          accountId: message.accountId,
                          subject: `Tr : ${message.subject}`,
                          body: `\n\n---\n${message.text ?? ""}`,
                          forwardOf: message.id,
                        });
                        setComposeOpen(true);
                      }}
                    >
                      <Forward className="mr-2 h-4 w-4" /> Transférer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        flag.mutate({
                          accountId: message.accountId,
                          messageId: message.id,
                          read: false,
                        })
                      }
                    >
                      <MailOpen className="mr-2 h-4 w-4" /> Marquer non lu
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        flag.mutate({
                          accountId: message.accountId,
                          messageId: message.id,
                          starred: !message.starred,
                        })
                      }
                    >
                      <Star className="mr-2 h-4 w-4" />
                      {message.starred ? "Retirer des favoris" : "Favori"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        move.mutate({
                          accountId: message.accountId,
                          messageId: message.id,
                          folder: "archive",
                        })
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archiver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        remove.mutate({ accountId: message.accountId, messageId: message.id })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Supprimer
                    </Button>
                  </div>

                  {message.attachments.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Pièces jointes
                      </Label>
                      {message.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between rounded border px-2 py-1 text-sm"
                        >
                          <span className="truncate">
                            {att.filename}{" "}
                            <span className="text-muted-foreground">({formatBytes(att.size)})</span>
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Télécharger ${att.filename}`}
                            onClick={() => void download(att.id, att.filename)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />
                  {message.html ? (
                    <iframe
                      title="Contenu du message"
                      sandbox=""
                      className="h-[45vh] w-full rounded border bg-background"
                      srcDoc={message.html}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">{message.text ?? "(vide)"}</pre>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <ComposeMailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        accounts={accounts}
        seed={seed}
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" /> Les contenus d'e-mails ne sont jamais stockés : ils sont
        lus en direct depuis vos serveurs de messagerie.
      </p>
    </div>
  );
}
