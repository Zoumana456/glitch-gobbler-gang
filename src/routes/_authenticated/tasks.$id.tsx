import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getTask,
  updateTask,
  addTaskComment,
  listTaskAssignees,
} from "@/lib/tasks.functions";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: () => ({
    meta: [
      { title: "Détail de la tâche — DailyBrief" },
      {
        name: "description",
        content: "Modifiez une tâche, changez son statut et échangez en commentaires.",
      },
    ],
  }),
  component: TaskDetailPage,
});

const UNASSIGNED = "__none__";

function TaskDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getTask);
  const updateFn = useServerFn(updateTask);
  const commentFn = useServerFn(addTaskComment);
  const assigneesFn = useServerFn(listTaskAssignees);

  const { data, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees"],
    queryFn: () => assigneesFn(),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const t = data?.task;
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? "");
    setAssignee(t.assignee_id ?? UNASSIGNED);
    setDueDate(t.due_date ?? "");
    setPriority(t.priority);
    setStatus(t.status);
  }, [data?.task]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          title,
          description: description || undefined,
          assigneeId: assignee === UNASSIGNED ? null : assignee,
          dueDate: dueDate || null,
          priority,
          status,
        },
      }),
    onSuccess: () => {
      toast.success("Tâche enregistrée");
      qc.invalidateQueries({ queryKey: ["task", id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const commentMut = useMutation({
    mutationFn: () => commentFn({ data: { taskId: id, content: comment } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!data) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Tâche introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/tasks">Retour aux tâches</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <header className="grid grid-cols-1 gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{data.task.title}</h1>
          <p className="text-sm text-muted-foreground">
            Créée par {data.task.creator_name || "—"} le{" "}
            {new Date(data.task.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="t-title">Titre</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Assignée à</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger aria-label="Assignée à">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Non assignée</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-due">Échéance</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger aria-label="Priorité">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["low", "normal", "high"] as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger aria-label="Statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["todo", "in_progress", "done", "cancelled"] as TaskStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={saveMut.isPending || title.trim().length < 2}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Commentaires ({data.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {data.comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  {c.author_name || "—"} ·{" "}
                  {new Date(c.created_at).toLocaleString("fr-FR")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
              </div>
            ))}
            {data.comments.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun commentaire.</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire…"
              aria-label="Ajouter un commentaire"
            />
            <Button
              className="w-full sm:w-auto"
              disabled={!comment.trim() || commentMut.isPending}
              onClick={() => commentMut.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
