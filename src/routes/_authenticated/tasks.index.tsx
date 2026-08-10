import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listTasks, setTaskStatus, deleteTask } from "@/lib/tasks.functions";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
} from "@/lib/tasks.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "Tâches — DailyBrief" },
      {
        name: "description",
        content:
          "Suivez les tâches de votre équipe : assignation, échéances, priorités et avancement.",
      },
    ],
  }),
  component: TasksPage,
});

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

function TasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const statusFn = useServerFn(setTaskStatus);
  const delFn = useServerFn(deleteTask);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listFn(),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) => statusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tâche supprimée");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (filter === "all" || t.status === filter) &&
        (!needle ||
          t.title.toLowerCase().includes(needle) ||
          (t.assignee_name ?? "").toLowerCase().includes(needle)),
    );
  }, [tasks, q, filter]);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <header className="grid grid-cols-1 gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex min-w-0 items-center gap-2">
            <ListChecks className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">Tâches</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Assignez et suivez le travail de votre équipe.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle tâche
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une tâche…"
          aria-label="Rechercher une tâche"
          className="sm:max-w-xs"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {(error as any)?.message ?? "Erreur de chargement"}
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ListChecks className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucune tâche pour le moment.
            </p>
            <Button asChild size="sm">
              <Link to="/tasks/new">Créer la première tâche</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((t) => (
          <Card key={t.id}>
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:flex sm:items-center">
              <div className="min-w-0 flex-1">
                <Link
                  to="/tasks/$id"
                  params={{ id: t.id }}
                  className="font-medium hover:underline break-words"
                >
                  {t.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant={t.priority === "high" ? "destructive" : "secondary"}
                  >
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </Badge>
                  {t.assignee_name && <span>{t.assignee_name}</span>}
                  {t.due_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(t.due_date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={t.status}
                  onValueChange={(v) =>
                    statusMut.mutate({ id: t.id, status: v as TaskStatus })
                  }
                >
                  <SelectTrigger
                    className="w-36"
                    aria-label={`Statut de ${t.title}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Supprimer ${t.title}`}
                  onClick={() => delMut.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
