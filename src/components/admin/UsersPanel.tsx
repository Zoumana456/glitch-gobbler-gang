import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, banUser, unbanUser, deleteUser, type AdminUserRow } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, MoreVertical, Ban, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatLongDate } from "@/lib/date-utils";

export function UsersPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Utilisateurs ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Nom</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Entreprise</th>
                  <th className="py-2">Rapports</th>
                  <th className="py-2">Inscrit le</th>
                  <th className="py-2">Statut</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <UserRow key={u.id} user={u} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserRow({ user, onChanged }: { user: AdminUserRow; onChanged: () => void }) {
  const banFn = useServerFn(banUser);
  const unbanFn = useServerFn(unbanUser);
  const delFn = useServerFn(deleteUser);
  const [banOpen, setBanOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const banMut = useMutation({
    mutationFn: () => banFn({ data: { userId: user.id, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Compte banni");
      setBanOpen(false);
      setReason("");
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const unbanMut = useMutation({
    mutationFn: () => unbanFn({ data: { userId: user.id } }),
    onSuccess: () => {
      toast.success("Compte réactivé");
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const delMut = useMutation({
    mutationFn: () => delFn({ data: { userId: user.id } }),
    onSuccess: () => {
      toast.success("Compte supprimé");
      setDelOpen(false);
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const canModerate = !user.is_admin;

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 font-medium">{user.full_name || "—"}</td>
      <td className="py-2 text-muted-foreground">{user.email}</td>
      <td className="py-2 text-muted-foreground">{user.company_name ?? "—"}</td>
      <td className="py-2">{user.reports_count}</td>
      <td className="py-2 text-muted-foreground">{formatLongDate(user.created_at)}</td>
      <td className="py-2">
        {user.is_admin ? (
          <Badge>Super admin</Badge>
        ) : user.is_banned ? (
          <Badge variant="destructive" title={user.banned_reason ?? undefined}>
            Banni
          </Badge>
        ) : (
          <Badge variant="secondary">Actif</Badge>
        )}
      </td>
      <td className="py-2 text-right">
        {canModerate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user.is_banned ? (
                <DropdownMenuItem onClick={() => unbanMut.mutate()}>
                  <ShieldOff className="h-4 w-4 mr-2" /> Réactiver
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setBanOpen(true)}>
                  <Ban className="h-4 w-4 mr-2" /> Bannir
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setDelOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Dialog open={banOpen} onOpenChange={setBanOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bannir {user.email} ?</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ce compte sera immédiatement déconnecté et ne pourra plus créer ni modifier de
                données.
              </p>
              <Label>Motif (optionnel)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex : violation des CGU"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => banMut.mutate()}
                disabled={banMut.isPending}
              >
                Bannir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={delOpen} onOpenChange={setDelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer définitivement {user.email} ?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Le compte et toutes ses données personnelles seront supprimés. Cette action est
              irréversible.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDelOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => delMut.mutate()}
                disabled={delMut.isPending}
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
