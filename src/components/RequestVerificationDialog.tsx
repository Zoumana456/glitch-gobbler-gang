import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { requestCompanyVerification } from "@/lib/reserved-names.functions";
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
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

const MAX = 5 * 1024 * 1024;
const ACCEPT =
  "application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function RequestVerificationDialog({
  open,
  onOpenChange,
  companyName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyName: string;
  onSubmitted?: () => void;
}) {
  const requestFn = useServerFn(requestCompanyVerification);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!file) {
      toast.error("Ajoutez un justificatif");
      return;
    }
    const { validateUpload, buildSafeStoragePath } = await import(
      "@/lib/upload-validation"
    );
    const check = await validateUpload(file, "company-proofs");
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Non connecté");
      const path = buildSafeStoragePath(uid, check.sanitizedExt);
      const { error: upErr } = await supabase.storage
        .from("company-proofs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      await requestFn({
        data: { name: companyName, proofPath: path, message: message || undefined },
      });
      toast.success("Demande envoyée. Un super admin va l'examiner.");
      setFile(null);
      setMessage("");
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Vérifier « {companyName} »
          </DialogTitle>
          <DialogDescription>
            Ce nom est réservé pour éviter l'usurpation d'identité. Envoyez un
            justificatif officiel (Kbis, mandat, licence, attestation…) pour
            prouver que vous représentez bien cette entreprise.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Justificatif (PDF, image, Word · 5 Mo max)</Label>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {file ? file.name : "Choisir un fichier"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Message (optionnel)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex : Je suis le responsable pays de ..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !file}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
