import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Clock, Loader2, Paperclip, Save, Send, X } from "lucide-react";
import { saveMailDraft, sendMailMessage } from "@/lib/mail/mail.functions";
import { scheduleMailMessage } from "@/lib/mail/scheduling.functions";
import { listMailSignatures, listMailTemplates } from "@/lib/mail/templates.functions";
import { applyTemplateVariables } from "@/lib/mail/template-vars";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  type MailAccount,
} from "@/lib/mail/types";

export type ComposeSeed = {
  accountId?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  replyTo?: string | null;
  forwardOf?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: MailAccount[];
  seed?: ComposeSeed;
};

type LocalAttachment = { filename: string; contentType: string; content: string; size: number };

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function presetDates() {
  const inOneHour = new Date(Date.now() + 3_600_000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const monday = new Date();
  const daysToMonday = (8 - monday.getDay()) % 7 || 7;
  monday.setDate(monday.getDate() + daysToMonday);
  monday.setHours(8, 0, 0, 0);
  return [
    { label: "Dans 1 h", value: toLocalInput(inOneHour) },
    { label: "Demain 8 h", value: toLocalInput(tomorrow) },
    { label: "Lundi 8 h", value: toLocalInput(monday) },
  ];
}

export function ComposeMailDialog({ open, onOpenChange, accounts, seed }: Props) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendMailMessage);
  const draftFn = useServerFn(saveMailDraft);
  const scheduleFn = useServerFn(scheduleMailMessage);
  const templatesFn = useServerFn(listMailTemplates);
  const signaturesFn = useServerFn(listMailSignatures);

  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<LocalAttachment[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [signatureId, setSignatureId] = useState("none");

  const { data: templates = [] } = useQuery({
    queryKey: ["mail", "templates"],
    queryFn: () => templatesFn(),
    enabled: open,
  });
  const { data: signatures = [] } = useQuery({
    queryKey: ["mail", "signatures"],
    queryFn: () => signaturesFn(),
    enabled: open,
  });

  const accountSignatures = useMemo(
    () => signatures.filter((s) => s.account_id === accountId),
    [signatures, accountId],
  );

  useEffect(() => {
    if (!open) return;
    setAccountId(seed?.accountId ?? accounts.find((a) => a.is_primary)?.id ?? accounts[0]?.id ?? "");
    setTo(seed?.to ?? "");
    setCc(seed?.cc ?? "");
    setBcc("");
    setSubject(seed?.subject ?? "");
    setBody(seed?.body ?? "");
    setFiles([]);
    setScheduling(false);
    setScheduledAt(toLocalInput(new Date(Date.now() + 3_600_000)));
  }, [open, seed, accounts]);

  useEffect(() => {
    if (!open) return;
    const def = accountSignatures.find((s) => s.is_default);
    setSignatureId(def ? def.id : "none");
  }, [open, accountId, accountSignatures]);

  const currentAccount = accounts.find((a) => a.id === accountId);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const vars = {
      recipient: splitAddresses(to)[0] ?? "",
      senderName: currentAccount?.display_name ?? currentAccount?.email ?? "",
    };
    if (t.subject) setSubject(applyTemplateVariables(t.subject, vars));
    setBody(applyTemplateVariables(t.body_html, vars));
    toast.success(`Modèle « ${t.name} » appliqué.`);
  }

  function bodyWithSignature(): string {
    const html = body.replace(/\n/g, "<br/>");
    const sig = accountSignatures.find((s) => s.id === signatureId);
    if (!sig) return html;
    return `${html}<br/><br/><div class="signature">${sig.body_html.replace(/\n/g, "<br/>")}</div>`;
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next: LocalAttachment[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} dépasse 15 Mo.`);
        continue;
      }
      if (f.type && !ALLOWED_ATTACHMENT_TYPES.includes(f.type)) {
        toast.error(`Type de fichier non autorisé : ${f.name}`);
        continue;
      }
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
      next.push({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
        content: btoa(bin),
        size: f.size,
      });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          accountId,
          to: splitAddresses(to),
          cc: splitAddresses(cc),
          bcc: splitAddresses(bcc),
          subject: subject.trim(),
          html: bodyWithSignature(),
          replyTo: seed?.replyTo ?? null,
          forwardOf: seed?.forwardOf ?? null,
          attachments: files.map(({ filename, content, contentType }) => ({
            filename,
            content,
            contentType,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Message envoyé.");
      qc.invalidateQueries({ queryKey: ["mail"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const schedule = useMutation({
    mutationFn: () =>
      scheduleFn({
        data: {
          accountId,
          to,
          cc,
          bcc,
          subject: subject.trim(),
          body: bodyWithSignature(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          replyTo: seed?.replyTo ?? null,
          attachments: files,
        },
      }),
    onSuccess: () => {
      toast.success(
        `Envoi programmé pour le ${new Date(scheduledAt).toLocaleString("fr-FR")}.`,
      );
      qc.invalidateQueries({ queryKey: ["mail"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = useMutation({
    mutationFn: () => draftFn({ data: { accountId, to, cc, bcc, subject, body } }),
    onSuccess: () => {
      toast.success("Brouillon enregistré.");
      qc.invalidateQueries({ queryKey: ["mail", "drafts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalid =
    !accountId || splitAddresses(to).length === 0 || !subject.trim() || !body.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
          <DialogDescription>
            Utilisez un modèle, choisissez une signature et envoyez maintenant ou à l'heure
            de votre choix.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Expéditeur</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un compte" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name ? `${a.display_name} — ${a.email}` : a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modèle</Label>
              <Select value="" onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={templates.length ? "Utiliser un modèle" : "Aucun modèle"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.scope === "company" ? " (partagé)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-to">À</Label>
            <Input
              id="c-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="destinataire@exemple.com"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-cc">Cc</Label>
              <Input id="c-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-bcc">Cci</Label>
              <Input id="c-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-subject">Objet</Label>
            <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-body">Message</Label>
            <Textarea id="c-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Signature</Label>
            <Select value={signatureId} onValueChange={setSignatureId}>
              <SelectTrigger>
                <SelectValue placeholder="Signature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune signature</SelectItem>
                {accountSignatures.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.is_default ? " (par défaut)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-files" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Pièces jointes (15 Mo max par fichier)
            </Label>
            <Input id="c-files" type="file" multiple onChange={(e) => void addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li
                    key={`${f.filename}-${i}`}
                    className="flex items-center justify-between rounded border px-2 py-1"
                  >
                    <span className="truncate">
                      {f.filename}{" "}
                      <span className="text-muted-foreground">({formatBytes(f.size)})</span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Retirer ${f.filename}`}
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-primary" /> Programmer l'envoi
              </div>
              <Button
                size="sm"
                variant={scheduling ? "secondary" : "outline"}
                onClick={() => setScheduling((v) => !v)}
              >
                {scheduling ? "Désactiver" : "Activer"}
              </Button>
            </div>
            {scheduling && (
              <div className="space-y-2">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  min={toLocalInput(new Date())}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {presetDates().map((p) => (
                    <Badge
                      key={p.label}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setScheduledAt(p.value)}
                    >
                      <Clock className="mr-1 h-3 w-3" /> {p.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Heure locale de votre appareil. L'envoi est déclenché automatiquement.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => draft.mutate()}
            disabled={!accountId || draft.isPending}
          >
            {draft.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer le brouillon
          </Button>
          {scheduling ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => schedule.mutate()}
              disabled={invalid || !scheduledAt || schedule.isPending}
            >
              {schedule.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-2 h-4 w-4" />
              )}
              Programmer
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              onClick={() => send.mutate()}
              disabled={invalid || send.isPending}
            >
              {send.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Envoyer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
