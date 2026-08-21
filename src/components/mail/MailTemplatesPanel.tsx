import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import {
  deleteMailTemplate,
  listMailTemplates,
  saveMailTemplate,
  type MailTemplate,
} from "@/lib/mail/templates.functions";
import { TEMPLATE_VARIABLES } from "@/lib/mail/template-vars";

export function MailTemplatesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMailTemplates);
  const saveFn = useServerFn(saveMailTemplate);
  const deleteFn = useServerFn(deleteMailTemplate);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MailTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"personal" | "company">("personal");

  const { data: templates = [] } = useQuery({
    queryKey: ["mail", "templates"],
    queryFn: () => listFn(),
  });

  function openNew(from?: MailTemplate, duplicate = false) {
    setEditing(duplicate ? null : (from ?? null));
    setName(from ? (duplicate ? `${from.name} (copie)` : from.name) : "");
    setSubject(from?.subject ?? "");
    setBody(from?.body_html ?? "");
    setScope((from?.scope as "personal" | "company") ?? "personal");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { id: editing?.id ?? null, name, subject, body, scope } }),
    onSuccess: () => {
      toast.success("Modèle enregistré.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["mail", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Modèle supprimé.");
      qc.invalidateQueries({ queryKey: ["mail", "templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Réutilisez vos messages types et gagnez du temps. Variables disponibles :{" "}
          {TEMPLATE_VARIABLES.map((v) => v.token).join(", ")}
        </p>
        <Button onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucun modèle pour l'instant.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 truncate text-base">
                  <FileText className="h-4 w-4 text-primary" /> {t.name}
                </CardTitle>
                <p className="truncate text-xs text-muted-foreground">
                  {t.subject || "(sans objet)"}
                </p>
              </div>
              <Badge variant={t.scope === "company" ? "default" : "secondary"}>
                {t.scope === "company" ? "Partagé" : "Personnel"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {t.body_html.replace(/<[^>]+>/g, " ")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openNew(t)}>
                  Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openNew(t, true)}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Dupliquer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Supprimer ${t.name}`}
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
            <DialogDescription>
              Les variables sont remplacées automatiquement à l'insertion dans un message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="t-name">Nom</Label>
              <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-subject">Objet</Label>
              <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-body">Contenu</Label>
              <Textarea id="t-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Portée</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "personal" | "company")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personnel</SelectItem>
                  <SelectItem value="company">Partagé avec l'entreprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ul className="space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
              {TEMPLATE_VARIABLES.map((v) => (
                <li key={v.token}>
                  <span className="font-mono">{v.token}</span> — {v.description}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
