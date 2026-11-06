import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enableShare, getShareToken } from "@/lib/reports.functions";

export function SendReportButtons({
  reportId,
  title,
  date,
}: {
  reportId: string;
  title: string;
  date: string;
}) {
  const getToken = useServerFn(getShareToken);
  const enable = useServerFn(enableShare);
  const [busy, setBusy] = useState<null | "wa" | "mail">(null);

  async function link(): Promise<string> {
    let token: string | null = null;
    try {
      const r = await getToken({ data: { id: reportId } });
      const expired = r.expires_at && new Date(r.expires_at).getTime() < Date.now();
      token = expired ? null : r.token;
    } catch {
      token = null;
    }
    if (!token) {
      const r = await enable({ data: { id: reportId, expiresInDays: 30 } });
      token = r.token;
    }
    return `${window.location.origin}/share/${token}`;
  }

  async function go(kind: "wa" | "mail") {
    // open the window synchronously so mobile browsers don't block it
    const win = kind === "wa" ? window.open("about:blank", "_blank") : null;
    setBusy(kind);
    try {
      const url = await link();
      const d = new Date(date).toLocaleDateString("fr-FR");
      const body = `Bonjour,\n\nVoici le rapport d'activité : ${title} — Date : ${d}.\nVous pouvez le consulter via ce lien sécurisé : ${url}\n\nCordialement.`;
      if (kind === "wa") {
        const target = `https://wa.me/?text=${encodeURIComponent(body)}`;
        if (win) win.location.href = target;
        else window.location.href = target;
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent(`Rapport : ${title}`)}&body=${encodeURIComponent(body)}`;
      }
    } catch (e: any) {
      win?.close();
      toast.error(e?.message ?? "Envoi impossible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => go("wa")} disabled={!!busy}>
        {busy === "wa" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
        WhatsApp
      </Button>
      <Button variant="outline" onClick={() => go("mail")} disabled={!!busy}>
        {busy === "mail" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
        Email
      </Button>
    </>
  );
}
