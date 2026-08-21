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
import { Switch } from "@/components/ui/switch";
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
import { PenLine, Plus, Trash2 } from "lucide-react";
import {
  deleteMailSignature,
  listMailSignatures,
  saveMailSignature,
  type MailSignature,
} from "@/lib/mail/templates.functions";
import type { MailAccount } from "@/lib/mail/types";

export function MailSignaturesPanel({ accounts }: { accounts: MailAccount[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMailSignatures);
  const saveFn = useServerFn(saveMailSignature);
  const deleteFn = useServerFn(deleteMailSignature);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MailSignature | null>(null);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: signatures = [] } = useQuery({
    queryKey: ["mail", "signatures"],
    queryFn: () => listFn(),
  });

  function openEditor(sig?: MailSignature) {
    setEditing(sig ?? null);
    setAccountId(sig?.account_id ?? accounts[0]?.id ?? "");
    setName(sig?.name ?? "");
    setBody(sig?.body_html ?? "");
    setIsDefault(sig?.is_default ?? signatures.length === 0);
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { id: editing?.id ?? null, accountId, name, body, isDefault } }),
    onSuccess: () => {
      toast.success("Signature enregistrée.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["mail", "signatures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Signature supprimée.");
      qc.invalidateQueries({ queryKey: ["mail", "signatures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailOf = (id: string) => accounts.find((a) => a.id === id)?.email ?? "Compte inconnu";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Plusieurs signatures par compte, avec une signature par défaut insérée
          automatiquement à la rédaction.
        </p>
        <Button onClick={() => openEditor()} disabled={accounts.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle signature
        </Button>
      </div>

      {signatures.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucune signature enregistrée.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {signatures.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 truncate text-base">
                  <PenLine className="h-4 w-4 text-primary" /> {s.name}
                </CardTitle>
                <p className="truncate text-xs text-muted-foreground">{emailOf(s.account_id)}</p>
              </div>
              {s.is_default && <Badge variant="secondary">Par défaut</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {s.body_html.replace(/<[^>]+>/g, " ")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditor(s)}>
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Supprimer ${s.name}`}
                  onClick={() => remove.mutate(s.id)}
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
            <DialogTitle>{editing ? "Modifier la signature" : "Nouvelle signature"}</DialogTitle>
            <DialogDescription>
              La signature par défaut d'un compte est proposée automatiquement dans la fenêtre
              de rédaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Compte</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un compte" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-name">Nom</Label>
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-body">Contenu</Label>
              <Textarea id="s-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Signature par défaut</p>
                <p className="text-xs text-muted-foreground">
                  Sélectionnée automatiquement pour ce compte.
                </p>
              </div>
              <Switch
                checked={isDefault}
                aria-label="Signature par défaut"
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!accountId || !name.trim() || save.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
