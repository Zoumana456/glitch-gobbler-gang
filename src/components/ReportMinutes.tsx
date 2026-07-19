import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMinutes,
  deleteMinute,
  type ReportMinute,
} from "@/lib/minutes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSignature, Plus, Pencil, Trash2, Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MinuteForm } from "@/components/MinuteForm";
import { MinuteView } from "@/components/MinuteView";
import { downloadMinutePdf } from "@/lib/pdf-utils";

function formatDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function ReportMinutes({
  reportId,
  reportTitle,
  canManage,
}: {
  reportId: string;
  reportTitle: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMinutes);
  const delFn = useServerFn(deleteMinute);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportMinute | null>(null);
  const [viewing, setViewing] = useState<ReportMinute | null>(null);
  const [confirmDel, setConfirmDel] = useState<ReportMinute | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["minutes", reportId],
    queryFn: () => listFn({ data: { reportId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("PV supprimé");
      queryClient.invalidateQueries({ queryKey: ["minutes", reportId] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible"),
  });

  async function handleDownload(m: ReportMinute) {
    setDownloadingId(m.id);
    try {
      await downloadMinutePdf(m, reportTitle);
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Procès-verbaux</h2>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau PV
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <FileSignature className="h-10 w-10 mx-auto text-primary mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Aucun procès-verbal créé</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {canManage
                ? "Créez un PV directement dans ce rapport avec dictée vocale, brouillon IA et export PDF."
                : "Les procès-verbaux liés à ce rapport apparaîtront ici dès qu'ils seront créés."}
            </p>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Créer un PV
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(q.data ?? []).map((m) => (
            <Card key={m.id}>
              <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{m.number}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {formatDT(m.held_at)}
                    {m.subject ? ` — ${m.subject}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(m)}>
                    <Eye className="h-4 w-4 mr-1" /> Voir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(m)}
                    disabled={downloadingId === m.id}
                  >
                    {downloadingId === m.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    PDF
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(m);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDel(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MinuteForm
        open={formOpen}
        onOpenChange={setFormOpen}
        reportId={reportId}
        minute={editing}
      />
      <MinuteView minute={viewing} open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce procès-verbal ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={() => confirmDel && del.mutate(confirmDel.id)}
            >
              {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
