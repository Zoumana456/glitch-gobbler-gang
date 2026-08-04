import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  submitReport,
  approveReport,
  rejectReport,
  getApprovalTimeline,
} from "@/lib/approvals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Check, X, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { REPORT_STATUS_LABEL, levelLabel, type ReportStatus } from "@/lib/reports.types";

const VARIANT: Record<ReportStatus, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  in_review: "secondary",
  approved: "default",
  rejected: "destructive",
};

export function ReportStatusBadge({ status }: { status?: ReportStatus | null }) {
  if (!status) return null;
  return <Badge variant={VARIANT[status]}>{REPORT_STATUS_LABEL[status]}</Badge>;
}

export function ReportWorkflowCard({
  reportId,
  status,
  isMine,
  isCurrentApprover,
}: {
  reportId: string;
  status: ReportStatus;
  isMine: boolean;
  isCurrentApprover: boolean;
}) {
  const queryClient = useQueryClient();
  const submitFn = useServerFn(submitReport);
  const approveFn = useServerFn(approveReport);
  const rejectFn = useServerFn(rejectReport);
  const timelineFn = useServerFn(getApprovalTimeline);
  const [comment, setComment] = useState("");
  const [showReject, setShowReject] = useState(false);

  const timeline = useQuery({
    queryKey: ["approval-timeline", reportId],
    queryFn: () => timelineFn({ data: { reportId } }),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    queryClient.invalidateQueries({ queryKey: ["approval-timeline", reportId] });
    queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { reportId } }),
    onSuccess: (r: any) => {
      toast.success(
        r?.status === "approved"
          ? "Rapport validé (vous êtes au sommet de la hiérarchie)"
          : "Rapport soumis à votre supérieur",
      );
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Soumission impossible"),
  });

  const approveMut = useMutation({
    mutationFn: () => approveFn({ data: { reportId, comment: comment || undefined } }),
    onSuccess: (r: any) => {
      toast.success(r?.escalated ? "Validé et transmis au niveau supérieur" : "Rapport validé");
      setComment("");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Validation impossible"),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectFn({ data: { reportId, comment } }),
    onSuccess: () => {
      toast.success("Rapport renvoyé à l'auteur");
      setComment("");
      setShowReject(false);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Rejet impossible"),
  });

  const canSubmit = isMine && (status === "draft" || status === "rejected");
  const busy = submitMut.isPending || approveMut.isPending || rejectMut.isPending;

  return (
    <Card>
      <CardContent className="py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="font-medium">Circuit de validation</span>
            <ReportStatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button onClick={() => submitMut.mutate()} disabled={busy}>
                {submitMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Soumettre à ma hiérarchie
              </Button>
            )}
            {isCurrentApprover && (
              <>
                <Button onClick={() => approveMut.mutate()} disabled={busy}>
                  {approveMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Valider
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowReject((v) => !v)}
                  disabled={busy}
                >
                  <X className="h-4 w-4 mr-2" />
                  Demander une correction
                </Button>
              </>
            )}
          </div>
        </div>

        {isCurrentApprover && (
          <div className="space-y-2">
            <Textarea
              placeholder={
                showReject
                  ? "Motif de la correction demandée (obligatoire)"
                  : "Commentaire de validation (optionnel)"
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            {showReject && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectMut.mutate()}
                disabled={busy || comment.trim().length < 3}
              >
                Confirmer le renvoi à l'auteur
              </Button>
            )}
          </div>
        )}

        {status === "rejected" && isMine && (
          <p className="text-sm text-destructive">
            Votre supérieur a demandé des corrections. Modifiez le rapport puis soumettez-le de
            nouveau.
          </p>
        )}

        {(timeline.data ?? []).length > 0 && (
          <ol className="space-y-2 border-l border-border pl-4">
            {(timeline.data ?? []).map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-medium">{e.approver_name}</span>{" "}
                <span className="text-muted-foreground">({levelLabel(e.level)})</span> —{" "}
                {e.decision === "submitted"
                  ? "a soumis le rapport"
                  : e.decision === "approved"
                    ? "a validé"
                    : "a demandé une correction"}
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(e.decided_at).toLocaleString("fr-FR")}
                </span>
                {e.comment && <div className="text-muted-foreground italic">« {e.comment} »</div>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
