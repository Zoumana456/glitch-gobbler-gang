import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DictationButton } from "@/components/DictationButton";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createMinute,
  updateMinute,
  generateMinuteFactsFromReport,
  type MinuteAttendee,
  type ReportMinute,
} from "@/lib/minutes.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportTitle?: string;
  minute?: ReportMinute | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetime(local: string): string {
  return new Date(local).toISOString();
}

export function MinuteForm({ open, onOpenChange, reportId, reportTitle, minute }: Props) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createMinute);
  const updateFn = useServerFn(updateMinute);
  const aiFn = useServerFn(generateMinuteFactsFromReport);

  const [number, setNumber] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [location, setLocation] = useState("");
  const [subject, setSubject] = useState("");
  const [attendees, setAttendees] = useState<MinuteAttendee[]>([{ name: "", role: "" }]);
  const [facts, setFacts] = useState("");
  const [decisions, setDecisions] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; heldAt?: string }>({});
  const reportIdValid = !!reportId && UUID_RE.test(reportId);


  useEffect(() => {
    if (!open) return;
    if (minute) {
      setNumber(minute.number);
      setHeldAt(toLocalDatetime(minute.held_at));
      setLocation(minute.location);
      setSubject(minute.subject);
      setAttendees(minute.attendees.length ? minute.attendees : [{ name: "", role: "" }]);
      setFacts(minute.facts);
      setDecisions(minute.decisions);
      setSignerName(minute.signer_name);
      setSignerRole(minute.signer_role);
    } else {
      setNumber("");
      setHeldAt(toLocalDatetime(new Date().toISOString()));
      setLocation("");
      setSubject("");
      setAttendees([{ name: "", role: "" }]);
      setFacts("");
      setDecisions("");
      setSignerName("");
      setSignerRole("");
    }
  }, [open, minute]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!minute && !reportIdValid) {
        throw new Error(
          "Rapport source manquant ou invalide. Fermez ce dialogue et sélectionnez un rapport avant de créer un PV.",
        );
      }
      const payload = {
        number,
        held_at: fromLocalDatetime(heldAt),
        location,
        subject,
        attendees: attendees.filter((a) => a.name.trim() || a.role.trim()),
        facts,
        decisions,
        signer_name: signerName,
        signer_role: signerRole,
      };
      if (minute) {
        return updateFn({ data: { id: minute.id, ...payload } });
      }
      return createFn({ data: { reportId, ...payload } });
    },
    onSuccess: (res: any) => {
      const linkedId = res?.report_id ?? reportId;
      toast.success(
        minute
          ? "PV mis à jour"
          : reportTitle
            ? `PV créé et lié au rapport « ${reportTitle} »`
            : "PV créé et lié au rapport source",
      );
      queryClient.invalidateQueries({ queryKey: ["minutes"] });
      queryClient.invalidateQueries({ queryKey: ["minutes", linkedId] });
      queryClient.invalidateQueries({ queryKey: ["minutes", "all"] });
      queryClient.invalidateQueries({ queryKey: ["minutes", "stats"] });
      setSubmitError(null);
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Enregistrement impossible";
      setSubmitError(msg);
      toast.error(msg);
    },
  });

  function submit() {
    setSubmitError(null);
    const errs: { subject?: string; heldAt?: string } = {};
    if (!heldAt) errs.heldAt = "Date et heure requises.";
    if (!subject.trim() || subject.trim().length < 3)
      errs.subject = "Objet requis (3 caractères minimum).";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Certains champs sont invalides.");
      return;
    }
    if (!minute && !reportIdValid) {
      const m =
        "Rapport source manquant ou invalide. Fermez ce dialogue et sélectionnez un rapport avant de créer un PV.";
      setSubmitError(m);
      toast.error(m);
      return;
    }
    mut.mutate();
  }


  async function handleAI() {
    setAiLoading(true);
    try {
      const res = await aiFn({ data: { reportId } });
      if (res.facts) setFacts(res.facts);
      if (res.decisions) setDecisions(res.decisions);
      toast.success("Brouillon généré");
    } catch (e: any) {
      toast.error(e?.message ?? "Génération impossible");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{minute ? "Modifier le procès-verbal" : "Nouveau procès-verbal"}</DialogTitle>
          {!minute && (
            <p className="text-xs text-muted-foreground">
              Rapport source :{" "}
              {reportIdValid ? (
                <span className="font-medium text-foreground">
                  {reportTitle ?? reportId.slice(0, 8) + "…"}
                </span>
              ) : (
                <span className="text-destructive font-medium">non sélectionné</span>
              )}
            </p>
          )}
        </DialogHeader>

        {!minute && !reportIdValid && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
            Rapport source manquant ou invalide. Fermez ce dialogue et sélectionnez un rapport avant de créer un PV.
          </div>
        )}
        {submitError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
            {submitError}
          </div>
        )}
        {mut.isSuccess && (
          <div className="rounded-md border border-green-500/40 bg-green-500/10 text-green-800 text-sm px-3 py-2">
            PV enregistré avec succès.
          </div>
        )}

        <div className="space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pv-number">Numéro</Label>
              <Input
                id="pv-number"
                placeholder="Auto (PV-2026-001)"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-held">Date et heure</Label>
              <Input
                id="pv-held"
                type="datetime-local"
                value={heldAt}
                onChange={(e) => setHeldAt(e.target.value)}
                required
                aria-invalid={!!fieldErrors.heldAt}
              />
              {fieldErrors.heldAt && (
                <p className="text-xs text-destructive">{fieldErrors.heldAt}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-location">Lieu</Label>
              <Input
                id="pv-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Salle de réunion, adresse…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-subject">Objet / motif</Label>
              <Input
                id="pv-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Réunion mensuelle, incident…"
                aria-invalid={!!fieldErrors.subject}
              />
              {fieldErrors.subject && (
                <p className="text-xs text-destructive">{fieldErrors.subject}</p>
              )}
            </div>
          </div>


          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Personnes présentes</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAttendees((a) => [...a, { name: "", role: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {attendees.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Nom"
                    value={a.name}
                    onChange={(e) => {
                      const copy = [...attendees];
                      copy[i] = { ...copy[i], name: e.target.value };
                      setAttendees(copy);
                    }}
                  />
                  <Input
                    placeholder="Fonction"
                    value={a.role}
                    onChange={(e) => {
                      const copy = [...attendees];
                      copy[i] = { ...copy[i], role: e.target.value };
                      setAttendees(copy);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setAttendees((arr) => arr.filter((_, j) => j !== i))}
                    aria-label="Retirer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label htmlFor="pv-facts">Faits constatés</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                  )}
                  Générer avec l'IA
                </Button>
                <DictationButton
                  label="Dicter"
                  onTranscript={(t) => setFacts((f) => (f ? f + " " + t : t))}
                />
              </div>
            </div>
            <Textarea
              id="pv-facts"
              rows={6}
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              placeholder="Description factuelle et chronologique des événements…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pv-decisions">Décisions / mesures prises</Label>
              <DictationButton
                label="Dicter"
                onTranscript={(t) => setDecisions((d) => (d ? d + " " + t : t))}
              />
            </div>
            <Textarea
              id="pv-decisions"
              rows={5}
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="Résolutions, actions à mener, responsables, délais…"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="pv-signer-name">Rédacteur — nom</Label>
              <Input
                id="pv-signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pv-signer-role">Rédacteur — fonction</Label>
              <Input
                id="pv-signer-role"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={mut.isPending || (!minute && !reportIdValid)}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {minute ? "Enregistrer" : "Créer le PV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
