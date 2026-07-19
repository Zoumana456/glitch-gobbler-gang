import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { requestCompanyVerification } from "@/lib/reserved-names.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  CheckCircle2,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const MAX = 5 * 1024 * 1024;
const ACCEPT_PROOF =
  "application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT_IMG = "image/png,image/jpeg,image/webp";

type IdType = "id_card" | "passport" | "driving_license";

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
  const [step, setStep] = useState(1);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idType, setIdType] = useState<IdType>("id_card");
  const [fullLegalName, setFullLegalName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setProofFile(null);
      setIdFile(null);
      setSelfieFile(null);
      setIdType("id_card");
      setFullLegalName("");
      setMessage("");
    }
  }, [open]);

  async function uploadFile(file: File, bucket = "company-proofs"): Promise<string> {
    const { validateUpload, buildSafeStoragePath } = await import(
      "@/lib/upload-validation"
    );
    const check = await validateUpload(file, bucket);
    if (!check.ok) throw new Error(check.reason);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Non connecté");
    const path = buildSafeStoragePath(uid, check.sanitizedExt);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  async function handleSubmit() {
    if (!proofFile || !idFile || !selfieFile) {
      toast.error("Complétez les 3 étapes");
      return;
    }
    if (fullLegalName.trim().length < 2) {
      toast.error("Nom légal requis");
      return;
    }
    setLoading(true);
    try {
      const [proofPath, identityPath, selfiePath] = await Promise.all([
        uploadFile(proofFile),
        uploadFile(idFile),
        uploadFile(selfieFile),
      ]);
      await requestFn({
        data: {
          name: companyName,
          proofPath,
          identityPath,
          identityType: idType,
          selfiePath,
          fullLegalName: fullLegalName.trim(),
          message: message || undefined,
        },
      });
      toast.success("Demande envoyée. L'IA pré-analyse vos documents, un super admin va l'examiner.");
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const canNext1 = !!proofFile;
  const canNext2 = !!idFile && fullLegalName.trim().length >= 2;
  const canSubmit = !!proofFile && !!idFile && !!selfieFile && fullLegalName.trim().length >= 2;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Vérifier « {companyName} »
            </DialogTitle>
            <DialogDescription>
              Ce nom est réservé. Pour éviter l'usurpation d'identité, nous
              devons vérifier votre identité en 3 étapes (KYC).
            </DialogDescription>
          </DialogHeader>

          <Stepper current={step} />

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Étape 1 · Justificatif d'entreprise</h3>
              <p className="text-xs text-muted-foreground">
                Kbis, mandat, licence, attestation… (PDF, image, Word · 5 Mo max)
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
                <Label>Photo de la pièce (recto lisible · image · 5 Mo max)</Label>
                <FilePicker
                  file={idFile}
                  onFile={setIdFile}
                  accept={ACCEPT_IMG}
                  max={MAX}
                  icon={<Upload className="h-4 w-4 mr-2" />}
                  label="Choisir la photo de la pièce"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Camera className="h-4 w-4" /> Étape 3 · Selfie avec la pièce
              </h3>
              <p className="text-xs text-muted-foreground">
                Tenez votre pièce d'identité à côté de votre visage. Les deux
                doivent être bien visibles et lisibles.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCameraOpen(true)} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" /> Prendre une photo
                </Button>
              </div>
              <FilePicker
                file={selfieFile}
                onFile={setSelfieFile}
                accept={ACCEPT_IMG}
                max={MAX}
                icon={<Upload className="h-4 w-4 mr-2" />}
                label="Ou importer une photo"
              />
              <div className="space-y-1.5">
                <Label>Message (optionnel)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Contexte, rôle dans l'entreprise…"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={loading}>
                Précédent
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canNext1 : !canNext2}
              >
                Suivant
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Envoyer la demande
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(f) => {
          setSelfieFile(f);
          setCameraOpen(false);
        }}
      />
    </>
  );
}

function Stepper({ current }: { current: number }) {
  const steps = ["Justificatif", "Identité", "Selfie"];
  return (
    <div className="flex items-center gap-2 py-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-primary/20 text-primary border border-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
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
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > max) {
            toast.error("Fichier trop volumineux (5 Mo max)");
            return;
          }
          onFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => ref.current?.click()}
        className="w-full"
      >
        {icon}
        <span className="truncate">{file ? file.name : label}</span>
      </Button>
    </>
  );
}

function CameraCapture({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (f: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        toast.error("Impossible d'accéder à la caméra : " + (e?.message ?? ""));
        onOpenChange(false);
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onOpenChange]);

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selfie avec la pièce d'identité</DialogTitle>
          <DialogDescription>
            Tenez la pièce à côté de votre visage puis capturez.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-black rounded overflow-hidden aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={snap} disabled={!ready}>
            <Camera className="h-4 w-4 mr-2" /> Capturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
