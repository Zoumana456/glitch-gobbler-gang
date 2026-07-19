import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listReportNotes,
  createReportNote,
  updateReportNote,
  deleteReportNote,
  type ReportNote,
} from "@/lib/notes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatLongDate } from "@/lib/date-utils";

type Props = {
  reportId: string;
  currentUserId: string;
  reportAuthorId: string;
  /** Whether the current user is allowed to write notes (DG viewing an employee's report). */
  canWrite: boolean;
};

export function ReportNotes({ reportId, currentUserId, canWrite }: Props) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listReportNotes);
  const createFn = useServerFn(createReportNote);
  const updateFn = useServerFn(updateReportNote);
  const deleteFn = useServerFn(deleteReportNote);

  const { data: notes = [] } = useQuery({
    queryKey: ["report-notes", reportId],
    queryFn: () => listFn({ data: { reportId } }),
  });

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const createMut = useMutation({
    mutationFn: (content: string) => createFn({ data: { reportId, content } }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["report-notes", reportId] });
      toast.success("Note ajoutée");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; content: string }) => updateFn({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["report-notes", reportId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["report-notes", reportId] }),
  });

  if (!canWrite && notes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Notes du DG ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.map((n: ReportNote) => (
          <div key={n.id} className="rounded-md border p-3 bg-muted/30">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="text-sm">
                <span className="font-medium">{n.author_name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {formatLongDate(n.created_at)}
                </span>
              </div>
              {n.author_id === currentUserId && (
                <div className="flex gap-1">
                  {editingId === n.id ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => updateMut.mutate({ id: n.id, content: editDraft })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditDraft(n.content);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMut.mutate(n.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            {editingId === n.id ? (
              <Textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={3}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{n.content}</p>
            )}
          </div>
        ))}

        {canWrite && (
          <div className="space-y-2 pt-2 border-t">
            <Textarea
              placeholder="Écrire une note ou une critique pour l'employé..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              onClick={() => draft.trim() && createMut.mutate(draft.trim())}
              disabled={!draft.trim() || createMut.isPending}
            >
              Ajouter la note
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
