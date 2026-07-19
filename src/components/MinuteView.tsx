import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReportMinute } from "@/lib/minutes.functions";

function formatDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function MinuteView({
  minute,
  open,
  onOpenChange,
}: {
  minute: ReportMinute | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!minute) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center tracking-wider">
            PROCÈS-VERBAL N° {minute.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground">
            <div>
              <div className="text-xs uppercase">Date et heure</div>
              <div className="text-foreground">{formatDT(minute.held_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase">Lieu</div>
              <div className="text-foreground">{minute.location || "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase">Objet</div>
              <div className="text-foreground">{minute.subject || "—"}</div>
            </div>
          </div>

          {minute.attendees.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2">Personnes présentes</h3>
              <ul className="border rounded-md divide-y">
                {minute.attendees.map((a, i) => (
                  <li key={i} className="flex justify-between px-3 py-1.5">
                    <span>{a.name || "—"}</span>
                    <span className="text-muted-foreground">{a.role}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {minute.facts && (
            <section>
              <h3 className="font-semibold mb-2">Faits constatés</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{minute.facts}</p>
            </section>
          )}

          {minute.decisions && (
            <section>
              <h3 className="font-semibold mb-2">Décisions / mesures prises</h3>
              <p className="whitespace-pre-wrap leading-relaxed">{minute.decisions}</p>
            </section>
          )}

          <section className="border-t pt-4 text-right">
            <div className="text-xs uppercase text-muted-foreground">Rédacteur</div>
            <div className="font-medium">{minute.signer_name || "—"}</div>
            <div className="text-muted-foreground">{minute.signer_role}</div>
            <div className="mt-3 h-16 border rounded-md" aria-label="Zone de signature" />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
