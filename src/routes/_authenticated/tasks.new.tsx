import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createTask, listTaskAssignees } from "@/lib/tasks.functions";
import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/tasks.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  head: () => ({
    meta: [
      { title: "Nouvelle tâche — DailyBrief" },
      {
        name: "description",
        content: "Créez une tâche, assignez-la à un collaborateur et fixez une échéance.",
      },
    ],
  }),
  component: NewTaskPage,
});

const UNASSIGNED = "__none__";

function NewTaskPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createTask);
  const assigneesFn = useServerFn(listTaskAssignees);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");

  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees"],
    queryFn: () => assigneesFn(),
  });

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title,
          description: description || undefined,
          assigneeId: assignee === UNASSIGNED ? null : assignee,
          dueDate: dueDate || null,
          priority,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("Tâche créée");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      navigate({ to: "/tasks/$id", params: { id: res.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-6">
      <header className="grid grid-cols-1 gap-4 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold truncate">Nouvelle tâche</h1>
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
            <Label htmlFor="task-title">Titre</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Préparer le rapport hebdomadaire"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Détails, attentes, livrables…"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                      {a.position_title ? ` — ${a.position_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Échéance</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
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
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={title.trim().length < 2 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Créer la tâche
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
