import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UserPlus, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listShareTargets,
  listSharesForReport,
  shareReport,
  updateSharePermission,
  revokeShare,
  type SharePermission,
} from "@/lib/shares.functions";

export function SharePeopleDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchTargets = useServerFn(listShareTargets);
  const fetchShares = useServerFn(listSharesForReport);
  const doShare = useServerFn(shareReport);
  const doUpdate = useServerFn(updateSharePermission);
  const doRevoke = useServerFn(revokeShare);

  const [selected, setSelected] = useState<string>("");
  const [perm, setPerm] = useState<SharePermission>("view");

  const targets = useQuery({
    queryKey: ["share-targets", reportId],
    queryFn: () => fetchTargets({ data: { reportId } }),
    enabled: open,
  });
  const shares = useQuery({
    queryKey: ["report-shares", reportId],
    queryFn: () => fetchShares({ data: { reportId } }),
    enabled: open,
  });

  const shareMut = useMutation({
    mutationFn: (v: { targetUserId: string; permission: SharePermission }) =>
      doShare({ data: { reportId, ...v } }),
    onSuccess: () => {
      toast.success("Rapport partagé");
      setSelected("");
      qc.invalidateQueries({ queryKey: ["report-shares", reportId] });
      qc.invalidateQueries({ queryKey: ["share-targets", reportId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Partage impossible"),
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; permission: SharePermission }) =>
      doUpdate({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-shares", reportId] }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => doRevoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Accès révoqué");
      qc.invalidateQueries({ queryKey: ["report-shares", reportId] });
      qc.invalidateQueries({ queryKey: ["share-targets", reportId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Partager avec une personne</DialogTitle>
          <DialogDescription>
            Partagez ce rapport avec un membre de votre entreprise. Vous
            pouvez donner un accès en lecture seule ou en modification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choisir une personne…" />
              </SelectTrigger>
              <SelectContent>
                {(targets.data ?? []).length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Aucun destinataire disponible
                  </div>
                ) : (
                  (targets.data ?? []).map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>
                      {t.full_name}
                      {t.email ? ` · ${t.email}` : ""}
                      {t.kind === "dg" ? " (DG)" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select value={perm} onValueChange={(v) => setPerm(v as SharePermission)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Lecture</SelectItem>
                <SelectItem value="edit">Modification</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() =>
                selected && shareMut.mutate({ targetUserId: selected, permission: perm })
              }
              disabled={!selected || shareMut.isPending}
            >
              {shareMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {shares.isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : (shares.data ?? []).length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aucun partage pour l'instant.
              </div>
            ) : (
              (shares.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.target_name}
                    </div>
                    {s.target_email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {s.target_email}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    {s.permission === "edit" ? (
                      <Pencil className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    {s.permission === "edit" ? "Modif." : "Lecture"}
                  </Badge>
                  <Select
                    value={s.permission}
                    onValueChange={(v) =>
                      updateMut.mutate({ id: s.id, permission: v as SharePermission })
                    }
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Lecture</SelectItem>
                      <SelectItem value="edit">Modification</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => revokeMut.mutate(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
