import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, PlugZap } from "lucide-react";
import { saveMailAccount, testMailAccount } from "@/lib/mail/mail.functions";
import { IMAP_PRESETS, PROVIDER_LABELS, type MailProvider } from "@/lib/mail/types";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const PROVIDERS: MailProvider[] = ["gmail", "microsoft", "yahoo", "imap"];

export function AddMailAccountDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const testFn = useServerFn(testMailAccount);
  const saveFn = useServerFn(saveMailAccount);

  const [provider, setProvider] = useState<MailProvider>("gmail");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const preset = IMAP_PRESETS[provider] ?? IMAP_PRESETS["yahoo"]!;
  const [imapHost, setImapHost] = useState(preset.imap_host);
  const [imapPort, setImapPort] = useState(String(preset.imap_port));
  const [smtpHost, setSmtpHost] = useState(preset.smtp_host);
  const [smtpPort, setSmtpPort] = useState(String(preset.smtp_port));
  const [imapSecurity, setImapSecurity] = useState(preset.security);
  const [smtpSecurity, setSmtpSecurity] = useState(preset.smtp_security);

  function applyProvider(p: MailProvider) {
    setProvider(p);
    const cfg = IMAP_PRESETS[p];
    if (cfg) {
      setImapHost(cfg.imap_host);
      setImapPort(String(cfg.imap_port));
      setSmtpHost(cfg.smtp_host);
      setSmtpPort(String(cfg.smtp_port));
      setImapSecurity(cfg.security);
      setSmtpSecurity(cfg.smtp_security);
    } else {
      setImapHost("");
      setImapPort("993");
      setSmtpHost("");
      setSmtpPort("465");
      setImapSecurity("SSL/TLS");
      setSmtpSecurity("SSL/TLS");
    }
  }

  function payload() {
    return {
      provider: provider as "imap" | "yahoo" | "gmail" | "microsoft",
      email: email.trim(),
      displayName: displayName.trim() || null,
      label: label.trim() || null,
      username: (username.trim() || email.trim()),
      password,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort),
      imapSecurity,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort),
      smtpSecurity,
    };
  }

  const test = useMutation({
    mutationFn: () => testFn({ data: payload() }),
    onSuccess: () => toast.success("Connexion réussie au serveur de messagerie."),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: payload() }),
    onSuccess: () => {
      toast.success("Compte connecté.");
      qc.invalidateQueries({ queryKey: ["mail"] });
      onOpenChange(false);
      setEmail("");
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = !email.trim() || !password || !imapHost.trim() || !smtpHost.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connecter un compte e-mail</DialogTitle>
          <DialogDescription>
            Les identifiants sont chiffrés (AES-256) et ne servent qu'à relever et envoyer
            vos messages. Aucun contenu d'e-mail n'est stocké dans DailyBrief.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyProvider(p)}
                className={`rounded-lg border p-3 text-left text-xs transition ${
                  provider === p
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>

          {IMAP_PRESETS[provider]?.hint && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{IMAP_PRESETS[provider]!.hint}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mail-email">Adresse e-mail</Label>
              <Input
                id="mail-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-password">Mot de passe (ou mot de passe d'application)</Label>
              <Input
                id="mail-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-name">Nom affiché</Label>
              <Input
                id="mail-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Direction générale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-label">Étiquette interne</Label>
              <Input
                id="mail-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Support, Direction…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-username">Identifiant IMAP/SMTP</Label>
              <Input
                id="mail-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="identique à l'e-mail par défaut"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imap-host">Serveur entrant (IMAP)</Label>
              <Input id="imap-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imap-port">Port IMAP</Label>
              <Input id="imap-port" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imap-sec">Sécurité IMAP</Label>
              <Input id="imap-sec" value={imapSecurity} onChange={(e) => setImapSecurity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Serveur sortant (SMTP)</Label>
              <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port SMTP</Label>
              <Input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-sec">Sécurité SMTP</Label>
              <Input id="smtp-sec" value={smtpSecurity} onChange={(e) => setSmtpSecurity(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={disabled || test.isPending}
            className="w-full sm:w-auto"
          >
            {test.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 h-4 w-4" />
            )}
            Tester la connexion
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={disabled || save.isPending}
            className="w-full sm:w-auto"
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connecter le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
