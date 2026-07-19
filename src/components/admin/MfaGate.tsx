import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = { onVerified: () => void };

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

export function MfaGate({ onVerified }: Props) {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const verifiedFactor = factors.find((f) => f.status === "verified" && f.factor_type === "totp");

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setFactors((data?.all ?? []) as Factor[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    // Nettoyer les facteurs "unverified" bloquants
    const stale = factors.filter((f) => f.status !== "verified");
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `admin-${Date.now()}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Enrôlement impossible");
      return;
    }
    setEnrollData({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setEnrolling(true);
  }

  async function verifyEnroll() {
    if (!enrollData || !code) return;
    setBusy(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (chalErr || !chal) {
      setBusy(false);
      toast.error(chalErr?.message ?? "Défi MFA impossible");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA activée. Session sécurisée.");
    setEnrolling(false);
    setEnrollData(null);
    setCode("");
    await refresh();
    onVerified();
  }

  async function challengeExisting() {
    if (!verifiedFactor || !code) return;
    setBusy(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
    if (chalErr || !chal) {
      setBusy(false);
      toast.error(chalErr?.message ?? "Défi MFA impossible");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: verifiedFactor.id,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA validée");
    setCode("");
    onVerified();
  }

  async function removeFactor(id: string) {
    if (!confirm("Retirer ce facteur 2FA ? Vous devrez le réenrôler.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    toast.success("Facteur retiré");
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Vérification 2FA…
      </div>
    );
  }

  // Aucun facteur → enrôlement
  if (!verifiedFactor && !enrolling) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Double authentification requise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Sécurisez votre compte super admin</AlertTitle>
            <AlertDescription>
              L'accès à l'administration exige une 2FA. Activez un authenticator (Google Authenticator,
              1Password, Authy…) pour générer un code à 6 chiffres à chaque connexion.
            </AlertDescription>
          </Alert>
          <Button onClick={startEnroll} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Activer la 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  // En cours d'enrôlement → QR + code
  if (enrolling && enrollData) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Scanner le QR code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <img src={enrollData.qr} alt="QR MFA" className="w-48 h-48 border rounded bg-white p-2" />
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Scannez avec votre app d'authentification, puis entrez le code affiché.
              </p>
              <div>
                <Label className="text-xs">Clé manuelle</Label>
                <code className="block bg-muted p-2 rounded text-xs break-all">{enrollData.secret}</code>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Code à 6 chiffres</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Vérifier et activer
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
                setEnrolling(false);
                setEnrollData(null);
                setCode("");
                await refresh();
              }}
            >
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Facteur existant, session en aal1 → challenge
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Validation 2FA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Saisissez le code à 6 chiffres généré par votre application d'authentification pour
          accéder à l'administration.
        </p>
        <div className="space-y-2">
          <Label>Code à 6 chiffres</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            maxLength={6}
            inputMode="numeric"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between">
          <Button onClick={challengeExisting} disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Valider
          </Button>
          {verifiedFactor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeFactor(verifiedFactor.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Retirer ce facteur
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
