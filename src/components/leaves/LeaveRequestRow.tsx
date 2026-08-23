import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Check, FileText, Send, Trash2, X } from "lucide-react";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_TONE,
  formatLeaveRange,
  type LeaveRequest,
} from "@/lib/leaves/types";
import {
  cancelLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
  leaveProofUrl,
  submitLeaveRequest,
} from "@/lib/leaves/leaves.functions";

type Props = { request: LeaveRequest; showOwner?: boolean };

export function LeaveRequestRow({ request: r, showOwner = false }: Props) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);

  const decideFn = useServerFn(decideLeaveRequest);
  const cancelFn = useServerFn(cancelLeaveRequest);
  const delFn = useServerFn(deleteLeaveRequest);
  const submitFn = useServerFn(submitLeaveRequest);
  const proofFn = useServerFn(leaveProofUrl);

  const refresh = () => qc.invalidateQueries({ queryKey: ["leaves"] });
  const onError = (e: any) => toast.error(e?.message ?? "Erreur");

  const decide = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      decideFn({ data: { id: r.id, decision, comment: comment.trim() || undefined } }),
    onSuccess: (_d, decision) => {
      toast.success(decision === "approved" ? "Absence validée." : "Demande refusée.");
      setComment("");
      setCommenting(false);
      refresh();
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { id: r.id } }),
    onSuccess: () => {
      toast.success("Demande annulée.");
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => delFn({ data: { id: r.id } }),
    onSuccess: () => {
      toast.success("Demande supprimée.");
      refresh();
    },
    onError,
  });
  const send = useMutation({
    mutationFn: () => submitFn({ data: { id: r.id } }),
    onSuccess: () => {
      toast.success("Demande envoyée pour validation.");
      refresh();
    },
    onError,
  });
  const proof = useMutation({
    mutationFn: () => proofFn({ data: { id: r.id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
    onError,
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.type_name}</span>
              <Badge className={LEAVE_STATUS_TONE[r.status]} variant="secondary">
                {LEAVE_STATUS_LABELS[r.status]}
              </Badge>
              {r.has_proof && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  disabled={proof.isPending}
                  onClick={() => proof.mutate()}
                >
                  <FileText className="mr-1 h-3 w-3" />
                  Justificatif
                </Button>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {formatLeaveRange(r.start_date, r.end_date)}
              <span>· {r.days_count} j</span>
              {showOwner && r.user_name && <span>· {r.user_name}</span>}
            </p>
            {r.reason && <p className="text-sm break-words">{r.reason}</p>}
            {r.status === "submitted" && r.approver_name && (
              <p className="text-xs text-muted-foreground">
                En attente de {r.approver_name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {r.can_decide && (
              <>
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate("approved")}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    commenting ? decide.mutate("rejected") : setCommenting(true)
                  }
                >
                  <X className="mr-1 h-4 w-4" />
                  Refuser
                </Button>
              </>
            )}
            {r.is_mine && r.status === "draft" && (
              <Button size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
                <Send className="mr-1 h-4 w-4" />
                Envoyer
              </Button>
            )}
            {r.is_mine && ["draft", "submitted", "approved"].includes(r.status) && (
              <Button
                size="sm"
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Annuler
              </Button>
            )}
            {r.is_mine && ["draft", "cancelled", "rejected"].includes(r.status) && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Supprimer la demande"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {commenting && r.can_decide && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Motif du refus (recommandé)"
            rows={2}
          />
        )}
      </CardContent>
    </Card>
  );
}
