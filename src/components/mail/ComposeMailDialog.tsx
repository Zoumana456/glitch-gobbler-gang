import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Paperclip, Save, Send, X } from "lucide-react";
import { saveMailDraft, sendMailMessage } from "@/lib/mail/mail.functions";
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

export function ComposeMailDialog({ open, onOpenChange, accounts, seed }: Props) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendMailMessage);
  const draftFn = useServerFn(saveMailDraft);

  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<LocalAttachment[]>([]);

  useEffect(() => {
    if (!open) return;
    setAccountId(seed?.accountId ?? accounts.find((a) => a.is_primary)?.id ?? accounts[0]?.id ?? "");
    setTo(seed?.to ?? "");
    setCc(seed?.cc ?? "");
    setBcc("");
    setSubject(seed?.subject ?? "");
    setBody(seed?.body ?? "");
    setFiles([]);
  }, [open, seed, accounts]);

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
          html: body.replace(/\n/g, "<br/>"),
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

  const draft = useMutation({
    mutationFn: () =>
      draftFn({ data: { accountId, to, cc, bcc, subject, body } }),
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
            Choisissez le compte expéditeur ; la signature configurée est ajoutée
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
            <Label htmlFor="c-to">À</Label>
            <Input id="c-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinataire@exemple.com" />
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
            <Label htmlFor="c-files" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Pièces jointes (15 Mo max par fichier)
            </Label>
            <Input id="c-files" type="file" multiple onChange={(e) => void addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.filename}-${i}`} className="flex items-center justify-between rounded border px-2 py-1">
                    <span className="truncate">
                      {f.filename} <span className="text-muted-foreground">({formatBytes(f.size)})</span>
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
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => draft.mutate()}
            disabled={!accountId || draft.isPending}
          >
            {draft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer le brouillon
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => send.mutate()} disabled={invalid || send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
