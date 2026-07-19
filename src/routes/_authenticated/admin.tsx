import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  checkIsPlatformAdmin,
  listCompaniesAdmin,
  updateSeatLimit,
  listPlatformAdmins,
  addPlatformAdmin,
  removePlatformAdmin,
} from "@/lib/platform.functions";
import {
  listReservedNames,
  addReservedName,
  removeReservedName,
  listVerificationRequests,
  reviewVerificationRequest,
} from "@/lib/reserved-names.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, ShieldAlert, ShieldCheck, Trash2, Plus, Users, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatLongDate } from "@/lib/date-utils";


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const checkFn = useServerFn(checkIsPlatformAdmin);
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: () => checkFn(),
  });

  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/reports" });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) return <div className="p-8">Chargement...</div>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Administration plateforme
        </h1>
        <p className="text-sm text-muted-foreground">
          Gérez les entreprises, leurs sièges, et les super administrateurs.
        </p>
      </header>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Entreprises</TabsTrigger>
          <TabsTrigger value="admins">Super admins</TabsTrigger>
          <TabsTrigger value="reserved">Noms réservés</TabsTrigger>
          <TabsTrigger value="verifications">Vérifications</TabsTrigger>
        </TabsList>
        <TabsContent value="companies" className="mt-4">
          <CompaniesPanel />
        </TabsContent>
        <TabsContent value="admins" className="mt-4">
          <AdminsPanel />
        </TabsContent>
        <TabsContent value="reserved" className="mt-4">
          <ReservedNamesPanel />
        </TabsContent>
        <TabsContent value="verifications" className="mt-4">
          <VerificationsPanel />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function CompaniesPanel() {
  const listFn = useServerFn(listCompaniesAdmin);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => listFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Entreprises ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Chargement...</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune entreprise.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Entreprise</th>
                  <th className="py-2">DG</th>
                  <th className="py-2">Membres</th>
                  <th className="py-2">Sièges</th>
                  <th className="py-2">Créée le</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-muted-foreground">
                      <div>{c.owner_name || "—"}</div>
                      <div className="text-xs">{c.owner_email}</div>
                    </td>
                    <td className="py-2">{c.members_count}</td>
                    <td className="py-2">
                      <span
                        className={
                          c.members_count >= c.seat_limit
                            ? "text-destructive font-medium"
                            : ""
                        }
                      >
                        {c.members_count} / {c.seat_limit}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatLongDate(c.created_at)}
                    </td>
                    <td className="py-2 text-right">
                      <SeatLimitDialog
                        companyId={c.id}
                        companyName={c.name}
                        current={c.seat_limit}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const SEAT_PRESETS = [10, 25, 50, 100, 250, 999];

function SeatLimitDialog({
  companyId,
  companyName,
  current,
}: {
  companyId: string;
  companyName: string;
  current: number;
}) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateSeatLimit);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);

  const mut = useMutation({
    mutationFn: (seatLimit: number) =>
      updateFn({ data: { companyId, seatLimit } }),
    onSuccess: () => {
      toast.success("Sièges mis à jour");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Modifier sièges
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sièges de {companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SEAT_PRESETS.map((n) => (
              <Button
                key={n}
                type="button"
                variant={value === n ? "default" : "outline"}
                size="sm"
                onClick={() => setValue(n)}
              >
                {n === 999 ? "Illimité (999)" : n}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Personnalisé</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mut.mutate(value)}
            disabled={mut.isPending || value < 1 || value > 1000}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminsPanel() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listPlatformAdmins);
  const addFn = useServerFn(addPlatformAdmin);
  const removeFn = useServerFn(removePlatformAdmin);
  const [email, setEmail] = useState("");

  const { data: admins = [] } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: () => listFn(),
  });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { email } }),
    onSuccess: () => {
      toast.success("Super admin ajouté");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Super admin retiré");
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Ajouter un super admin
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label>Email (doit avoir un compte existant)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <Button onClick={() => addMut.mutate()} disabled={!email || addMut.isPending}>
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Super admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {admins.map((a) => (
              <div
                key={a.user_id}
                className="flex items-center justify-between border rounded p-3"
              >
                <div>
                  <div className="font-medium">{a.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Retirer ${a.email} des super admins ?`))
                      removeMut.mutate(a.user_id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReservedNamesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReservedNames);
  const addFn = useServerFn(addReservedName);
  const removeFn = useServerFn(removeReservedName);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["reserved-names"],
    queryFn: () => listFn(),
  });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { name, notes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Nom réservé ajouté");
      setName("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["reserved-names"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Retiré");
      qc.invalidateQueries({ queryKey: ["reserved-names"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Ajouter un nom réservé
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <Label>Nom de la marque</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Jumia" />
          </div>
          <div className="space-y-1">
            <Label>Note (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={() => addMut.mutate()} disabled={!name.trim() || addMut.isPending}>
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Noms protégés ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun nom réservé.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      slug : {r.slug}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Retirer « ${r.display_name} » ?`))
                        removeMut.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerificationsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVerificationRequests);
  const reviewFn = useServerFn(reviewVerificationRequest);
  const { data: rows = [] } = useQuery({
    queryKey: ["verification-requests"],
    queryFn: () => listFn(),
  });

  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const reviewMut = useMutation({
    mutationFn: (p: { id: string; approve: boolean; note?: string }) =>
      reviewFn({ data: p }),
    onSuccess: () => {
      toast.success("Demande traitée");
      qc.invalidateQueries({ queryKey: ["verification-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");
  const ordered = [...pending, ...others];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Demandes de vérification ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande.</p>
        ) : (
          <div className="space-y-3">
            {ordered.map((r) => (
              <div key={r.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">
                      « {r.requested_name} »{" "}
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "default"
                            : r.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.user_name || "—"} · {r.user_email} ·{" "}
                      {formatLongDate(r.created_at)}
                    </div>
                  </div>
                  {r.proof_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={r.proof_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Justificatif
                      </a>
                    </Button>
                  )}
                </div>
                {r.message && (
                  <div className="text-sm rounded bg-muted/40 p-2">{r.message}</div>
                )}
                {r.admin_note && (
                  <div className="text-xs text-muted-foreground">
                    Note admin : {r.admin_note}
                  </div>
                )}
                {r.status === "pending" && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      value={noteById[r.id] ?? ""}
                      onChange={(e) =>
                        setNoteById((m) => ({ ...m, [r.id]: e.target.value }))
                      }
                      placeholder="Note interne (optionnel)"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          reviewMut.mutate({
                            id: r.id,
                            approve: true,
                            note: noteById[r.id],
                          })
                        }
                        disabled={reviewMut.isPending}
                      >
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          reviewMut.mutate({
                            id: r.id,
                            approve: false,
                            note: noteById[r.id],
                          })
                        }
                        disabled={reviewMut.isPending}
                      >
                        Refuser
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

