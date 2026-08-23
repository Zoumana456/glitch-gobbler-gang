import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import { createLeaveRequest, listLeaveTypes } from "@/lib/leaves/leaves.functions";
import { countLeaveDays } from "@/lib/leaves/types";

export const Route = createFileRoute("/_authenticated/leaves/new")({
  head: () => ({
    meta: [
      { title: "Nouvelle demande d'absence — DailyBrief" },
      {
        name: "description",
        content:
          "Créez une demande de congé ou d'absence et envoyez-la à votre responsable.",
      },
      { property: "og:title", content: "Nouvelle demande d'absence — DailyBrief" },
      {
        property: "og:description",
        content: "Déclarez vos congés en quelques secondes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewLeavePage;
});

function NewLeavePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const typesFn = useServerFn(listLeaveTypes);
  const createFn = useServerFn(createLeaveRequest);

  const { data: types = [] } = useQuery({
    queryKey: ["leaves", "types"],
    queryFn: () => typesFn(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [halfStart, setHalfStart] = useState(false);
  const [halfEnd, setHalfEnd] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const selected = types.find((t) => t.id === typeId);
  const days = useMemo(
    () => countLeaveDays(startDate, endDate, halfStart, halfEnd),
    [startDate, endDate, halfStart, halfEnd],
  );

  async function uploadProof(): Promise<string | null> {
    if (!file) return null;
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expirée.");
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("leave-proofs")
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      return path;
    } finally {
      setUploading(false);
    }
  }

  const create = useMutation({
    mutationFn: async (submit: boolean) => {
      const proofPath = await uploadProof();
      return createFn({
        data: {
          typeId,
          startDate,
          endDate,
          halfStart,
          halfEnd,
          reason: reason.trim() || undefined,
          proofPath,
          submit,
        },
      });
    },
    onSuccess: ({ overlaps }) => {
      toast.success("Demande enregistrée.");
      if (overlaps.length > 0)
        toast.warning(
          `Absence simultanée dans votre service : ${overlaps.slice(0, 3).join(", ")}.`,
        );
      qc.invalidateQueries({ queryKey: ["leaves"] });
      navigate({ to: "/leaves" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const busy = create.isPending || uploading;
  const ready = !!typeId && !!startDate && !!endDate && days > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/leaves">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux congés
        </Link>
      </Button>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <CalendarPlus className="h-6 w-6 text-primary" />
          Nouvelle demande d'absence
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre responsable direct recevra la demande pour validation.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label>Type d'absence</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger aria-label="Type d'absence">
                <SelectValue placeholder="Choisir un type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {!t.is_paid ? " (sans solde)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leave-start">Du</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={halfStart}
                  onCheckedChange={(v) => setHalfStart(!!v)}
                />
                Demi-journée
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-end">Au</Label>
              <Input
                id="leave-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {endDate !== startDate && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={halfEnd}
                    onCheckedChange={(v) => setHalfEnd(!!v)}
                  />
                  Demi-journée
                </label>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Durée décomptée : <span className="font-medium text-foreground">{days} jour(s)</span>{" "}
            ouvré(s).
          </p>

          <div className="space-y-2">
            <Label htmlFor="leave-reason">Motif (facultatif)</Label>
            <Textarea
              id="leave-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Précisions utiles pour votre responsable…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-proof">
              Justificatif {selected?.requires_proof ? "(requis)" : "(facultatif)"}
            </Label>
            <Input
              id="leave-proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Visible uniquement par vous, votre responsable et la direction.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={!ready || busy}
              onClick={() => create.mutate(true)}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer pour validation
            </Button>
            <Button
              variant="outline"
              disabled={!ready || busy}
              onClick={() => create.mutate(false)}
            >
              Enregistrer en brouillon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
