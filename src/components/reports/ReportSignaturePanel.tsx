import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Loader2, PenLine, Stamp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signReport } from "@/lib/reports.functions";
import type { ReportSignature } from "@/lib/reports.types";

function fmt(d: string) {
  const x = new Date(d);
  return `${x.toLocaleDateString("fr-FR")} à ${x.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SignatureBlock({ sig }: { sig: ReportSignature }) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Lu et approuvé</div>
        <div className="font-medium">{sig.signer_name}</div>
        {sig.signer_role && <div className="text-sm text-muted-foreground">{sig.signer_role}</div>}
        <div className="text-xs text-muted-foreground mt-1">Le {fmt(sig.signed_at)}</div>
      </div>
      {sig.signature_image && (
        <img src={sig.signature_image} alt="Signature" className="h-20 w-auto object-contain" />
      )}
      {sig.stamp_image && (
        <img src={sig.stamp_image} alt="Cachet" className="h-24 w-24 object-contain" />
      )}
    </div>
  );
}

async function fileToPng(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 400;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export function ReportSignaturePanel({
  reportId,
  signature,
  defaultName,
  canSign,
}: {
  reportId: string;
  signature: ReportSignature | null | undefined;
  defaultName: string;
  canSign: boolean;
}) {
  const sign = useServerFn(signReport);
  const qc = useQueryClient();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState("");
  const [stamp, setStamp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !editing) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, [editing]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }
  function clearCanvas() {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  async function save() {
    if (!name.trim()) return toast.error("Indiquez le nom du signataire");
    if (!hasInk && !stamp) return toast.error("Signez ou ajoutez un cachet");
    setSaving(true);
    try {
      await sign({
        data: {
          id: reportId,
          signature_image: hasInk ? canvas.current!.toDataURL("image/png") : null,
          stamp_image: stamp,
          signer_name: name.trim(),
          signer_role: role.trim(),
        },
      });
      toast.success("Rapport signé");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["report", reportId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Signature impossible");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await sign({ data: { id: reportId, clear: true } });
      qc.invalidateQueries({ queryKey: ["report", reportId] });
      toast.success("Signature retirée");
    } catch (e: any) {
      toast.error(e?.message ?? "Action impossible");
    } finally {
      setSaving(false);
    }
  }

  if (!signature && !canSign) return null;

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            <PenLine className="h-4 w-4" /> Signature & cachet
          </h2>
          {canSign && !editing && (
            <div className="flex gap-2">
              {signature && (
                <Button variant="ghost" size="sm" onClick={remove} disabled={saving}>
                  <Trash2 className="h-4 w-4 mr-1" /> Retirer
                </Button>
              )}
              <Button size="sm" onClick={() => setEditing(true)}>
                {signature ? "Re-signer" : "Signer le rapport"}
              </Button>
            </div>
          )}
        </div>

        {signature && !editing && <SignatureBlock sig={signature} />}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nom du signataire</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fonction</Label>
                <Input value={role} placeholder="Chef de projet" onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Signature (au doigt ou à la souris)</Label>
              <canvas
                ref={canvas}
                className="mt-1 h-40 w-full touch-none rounded-md border border-dashed border-border bg-background"
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={() => (drawing.current = false)}
                onPointerLeave={() => (drawing.current = false)}
              />
              <Button variant="ghost" size="sm" className="mt-1" onClick={clearCanvas}>
                <Eraser className="h-4 w-4 mr-1" /> Effacer
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Stamp className="h-4 w-4" /> {stamp ? "Changer le cachet" : "Ajouter un cachet (image)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setStamp(await fileToPng(f));
                    e.target.value = "";
                  }}
                />
              </Label>
              {stamp && <img src={stamp} alt="Cachet" className="h-16 w-16 object-contain" />}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Valider la signature
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
