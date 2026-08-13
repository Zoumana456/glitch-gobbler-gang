import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  IdCard,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const MAX = 50 * 1024 * 1024;
const ACCEPT_PROOF =
  "application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT_IMG = "image/png,image/jpeg,image/webp";

type IdType = "id_card" | "passport" | "driving_license";

export function RequestVerificationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idType, setIdType] = useState<IdType | "">("");
  const [fullLegalName, setFullLegalName] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setProofFile(null);
      setIdFile(null);
      setIdType("");
      setFullLegalName("");
    }, 300);
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!proofFile || !idFile || !idType || !fullLegalName.trim()) {
        throw new Error("Informations manquantes");
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Non connecté");

      // Validation côté client simple (taille + ext de base)
      if (proofFile.size > MAX || idFile.size > MAX) {
        throw new Error("Un fichier dépasse la limite de 50 Mo");
      }

      // Upload proof (justificatif d'entreprise)
      const proofExt = proofFile.name.split(".").pop()?.toLowerCase() || "bin";
      const proofPath = `${uid}/${crypto.randomUUID()}_proof.${proofExt}`;
      const { error: pErr } = await supabase.storage
        .from("company-proofs")
        .upload(proofPath, proofFile);
      if (pErr) throw new Error("Erreur envoi justificatif: " + pErr.message);

      // Upload ID
      const idExt = idFile.name.split(".").pop()?.toLowerCase() || "bin";
      const idPath = `${uid}/${crypto.randomUUID()}_id.${idExt}`;
      const { error: iErr } = await supabase.storage
        .from("company-proofs")
        .upload(idPath, idFile);
      if (iErr) throw new Error("Erreur envoi pièce: " + iErr.message);

      // Créer la demande
      const { error: reqErr } = await supabase.from("verification_requests").insert({
        user_id: uid,
        company_proof_path: proofPath,
        id_document_path: idPath,
        id_document_type: idType,
        full_legal_name: fullLegalName.trim(),
        status: "pending",
      });
      if (reqErr) {
        // cleanup best-effort
        supabase.storage.from("company-proofs").remove([proofPath, idPath]);
        throw new Error("Erreur création demande: " + reqErr.message);
      }
      return true;
    },
    onSuccess: () => {
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ["my-verification"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur inattendue");
    },
    onSettled: () => setSubmitting(false),
  });

  const nextStep = () => {
    if (step === 1 && !proofFile) {
      toast.error("Veuillez fournir un justificatif d'entreprise");
      return;
    }
    if (step === 2) {
      if (!idType) return toast.error("Veuillez sélectionner le type de pièce");
      if (!fullLegalName.trim()) return toast.error("Nom légal requis");
      if (!idFile) return toast.error("Photo de la pièce requise");
      
      setSubmitting(true);
      submitMut.mutate();
      return;
    }
    setStep((s) => (s + 1) as any);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Demande de vérification</DialogTitle>
          <DialogDescription>
            {step === 3
              ? "Demande envoyée"
              : "Renforcez la confiance de vos destinataires en validant votre identité professionnelle."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Étape 1 · Justificatif d'entreprise</h3>
              <p className="text-xs text-muted-foreground">
                Kbis, mandat, licence, attestation… (PDF, image, Word · 50 Mo max)
              </p>
              <FilePicker
                file={proofFile}
                onFile={setProofFile}
                accept={ACCEPT_PROOF}
                max={MAX}
                icon={<Upload className="h-4 w-4 mr-2" />}
                label="Choisir le justificatif"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <IdCard className="h-4 w-4" /> Étape 2 · Pièce d'identité
              </h3>
              <div className="space-y-1.5">
                <Label>Type de pièce</Label>
                <Select value={idType} onValueChange={(v) => setIdType(v as IdType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id_card">Carte d'identité</SelectItem>
                    <SelectItem value="passport">Passeport</SelectItem>
                    <SelectItem value="driving_license">Permis de conduire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nom légal complet (tel qu'inscrit sur la pièce)</Label>
                <Input
                  value={fullLegalName}
                  onChange={(e) => setFullLegalName(e.target.value)}
                  placeholder="Ex : Jean Dupont"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Photo de la pièce (recto lisible · image · 50 Mo max)</Label>
                <FilePicker
                  file={idFile}
                  onFile={setIdFile}
                  accept={ACCEPT_IMG}
                  max={MAX}
                  icon={<Upload className="h-4 w-4 mr-2" />}
                  label="Choisir la photo"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="rounded-full bg-green-100 p-3 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Demande reçue</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                  Votre dossier est en cours d'analyse. Le badge pro sera activé dès validation.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step < 3 ? (
            <div className="flex w-full justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => (step === 1 ? handleClose() : setStep(1))}
                disabled={submitting}
              >
                {step === 1 ? "Annuler" : "Retour"}
              </Button>
              <Button onClick={nextStep} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {step === 2 ? "Soumettre" : "Suivant"}
              </Button>
            </div>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Terminer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilePicker({
  file,
  onFile,
  accept,
  max,
  icon,
  label,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  max: number;
  icon: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {file ? (
        <div className="flex items-center justify-between p-2 rounded border bg-muted/30 text-sm">
          <span className="truncate flex-1 max-w-[240px] font-medium" title={file.name}>
            {file.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onFile(null)}
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            Retirer
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() => ref.current?.click()}
        >
          {icon}
          {label}
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > max) {
            toast.error("Fichier trop volumineux (50 Mo max)");
            return;
          }
          onFile(f);
        }}
      />
    </div>
  );
}
