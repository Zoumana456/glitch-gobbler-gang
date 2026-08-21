import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  mailStatus,
  saveMailAccount,
  startMailOAuth,
  testMailAccount,
} from "@/lib/mail/mail.functions";

import {
  detectProvider,
  MAIL_SECURITY_OPTIONS,
  PROVIDER_APP_PASSWORD_HELP,
  PROVIDER_LABELS,
  IMAP_PRESETS,
  type MailProvider,
} from "@/lib/mail/types";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function AddMailAccountDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const testFn = useServerFn(testMailAccount);
  const saveFn = useServerFn(saveMailAccount);
  const statusFn = useServerFn(mailStatus);
  const startOAuthFn = useServerFn(startMailOAuth);

  const { data: status } = useQuery({
    queryKey: ["mail", "status"],
    queryFn: () => statusFn({}),
    enabled: open,
  });
  const oauth = status?.oauth;

  const [oauthPending, setOauthPending] = useState<"gmail" | "microsoft" | null>(null);
  const connect = useMutation({
    mutationFn: async (provider: "gmail" | "microsoft") => {
      setOauthPending(provider);
      return startOAuthFn({ data: { provider, origin: window.location.origin } });
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => {
      setOauthPending(null);
      toast.error(e.message);
    },
  });


  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [touchedServers, setTouchedServers] = useState(false);

  const [provider, setProvider] = useState<MailProvider>("imap");
  const [displayName, setDisplayName] = useState("");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [imapSecurity, setImapSecurity] = useState("SSL/TLS");
  const [smtpSecurity, setSmtpSecurity] = useState("SSL/TLS");
  const [guessed, setGuessed] = useState(true);

  // Détection automatique du fournisseur dès que l'adresse est complète.
  useEffect(() => {
    if (!email.includes("@")) return;
    const d = detectProvider(email);
    setProvider(d.provider);
    setGuessed(d.guessed);
    if (touchedServers) return;
    setImapHost(d.imap_host);
    setImapPort(String(d.imap_port));
    setSmtpHost(d.smtp_host);
    setSmtpPort(String(d.smtp_port));
    setImapSecurity(d.security);
    setSmtpSecurity(d.smtp_security);
  }, [email, touchedServers]);

  function reset() {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setLabel("");
    setUsername("");
    setTouchedServers(false);
    setAdvancedOpen(false);
  }

  function payload() {
    return {
      provider,
      email: email.trim(),
      displayName: displayName.trim() || null,
      label: label.trim() || null,
      username: username.trim() || email.trim(),
      password,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort),
      imapSecurity,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort),
      smtpSecurity,
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      // Test intégré : on vérifie avant d'enregistrer.
      await testFn({ data: payload() });
      return saveFn({ data: payload() });
    },
    onSuccess: () => {
      toast.success("Compte connecté.");
      qc.invalidateQueries({ queryKey: ["mail"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => {
      setAdvancedOpen(true);
      toast.error(
        e.message ||
          "Connexion impossible. Vérifiez le mot de passe d'application et les serveurs dans les réglages avancés.",
      );
    },
  });

  const help = PROVIDER_APP_PASSWORD_HELP[provider];
  const hint = IMAP_PRESETS[provider]?.hint;
  const ready = email.includes("@") && !!password && !!imapHost.trim() && !!smtpHost.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connecter un compte e-mail</DialogTitle>
          <DialogDescription>
            Deux informations suffisent : votre adresse et votre mot de passe. Les
            identifiants sont chiffrés (AES-256) et aucun contenu d'e-mail n'est stocké.
          </DialogDescription>
        </DialogHeader>

        {(oauth?.gmail || oauth?.microsoft) && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">Connexion en un clic</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {oauth?.gmail && (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={oauthPending !== null}
                  onClick={() => connect.mutate("gmail")}
                >
                  {oauthPending === "gmail" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Continuer avec Google
                </Button>
              )}
              {oauth?.microsoft && (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={oauthPending !== null}
                  onClick={() => connect.mutate("microsoft")}
                >
                  {oauthPending === "microsoft" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Continuer avec Microsoft
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Aucun mot de passe à saisir : l'autorisation se fait chez le fournisseur.
            </p>
          </div>
        )}

        <div className="space-y-4">

          <div className="space-y-2">
            <Label htmlFor="mail-email">Adresse e-mail</Label>
            <Input
              id="mail-email"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {email.includes("@") && !guessed && (
            <p className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {PROVIDER_LABELS[provider]} détecté automatiquement — rien d'autre à remplir.
            </p>
          )}

          {email.includes("@") && guessed && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Boîte professionnelle : nous utilisons {imapHost || "imap.votre-domaine"} et{" "}
                {smtpHost || "smtp.votre-domaine"}. Si la connexion échoue, ajustez les
                réglages avancés ci-dessous.
              </AlertDescription>
            </Alert>
          )}

          {hint && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {hint}
            </p>
          )}

          {help && (
            <a
              href={help.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {help.label} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">
                <ChevronDown
                  className={`mr-1 h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                />
                Réglages avancés (facultatif)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2 sm:col-span-2">
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
                <Input
                  id="imap-host"
                  value={imapHost}
                  onChange={(e) => {
                    setTouchedServers(true);
                    setImapHost(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imap-port">Port IMAP</Label>
                <Input
                  id="imap-port"
                  inputMode="numeric"
                  value={imapPort}
                  onChange={(e) => {
                    setTouchedServers(true);
                    setImapPort(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Sécurité IMAP</Label>
                <Select
                  value={imapSecurity}
                  onValueChange={(v) => {
                    setTouchedServers(true);
                    setImapSecurity(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIL_SECURITY_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-host">Serveur sortant (SMTP)</Label>
                <Input
                  id="smtp-host"
                  value={smtpHost}
                  onChange={(e) => {
                    setTouchedServers(true);
                    setSmtpHost(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port SMTP</Label>
                <Input
                  id="smtp-port"
                  inputMode="numeric"
                  value={smtpPort}
                  onChange={(e) => {
                    setTouchedServers(true);
                    setSmtpPort(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Sécurité SMTP</Label>
                <Select
                  value={smtpSecurity}
                  onValueChange={(v) => {
                    setTouchedServers(true);
                    setSmtpSecurity(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIL_SECURITY_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={!ready || save.isPending}
            className="w-full"
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {save.isPending ? "Vérification…" : "Connecter le compte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
