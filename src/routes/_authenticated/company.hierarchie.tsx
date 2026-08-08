import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getHierarchy, updateMemberHierarchy } from "@/lib/hierarchy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import { Building2, Users, Pencil, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { HIERARCHY_LEVELS, levelLabel, type HierarchyMember } from "@/lib/reports.types";

export const Route = createFileRoute("/_authenticated/company/hierarchie")({
  head: () => ({
    meta: [
      { title: "Organigramme — DailyBrief" },
      {
        name: "description",
        content:
          "Visualisez la hiérarchie de votre entreprise et le suivi quotidien des rapports par niveau.",
      },
      { property: "og:title", content: "Organigramme — DailyBrief" },
      {
        property: "og:description",
        content: "Hiérarchie d'entreprise et suivi des rapports journaliers par niveau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HierarchyPage,
});

function StateChip({ state }: { state: HierarchyMember["today_state"] }) {
  if (state === "approved")
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Validé
      </Badge>
    );
  if (state === "submitted" || state === "in_review")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> En validation
      </Badge>
    );
  if (state === "rejected")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> À corriger
      </Badge>
    );
  if (state === "draft") return <Badge variant="outline">Brouillon</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Aucun rapport</Badge>;
}

function HierarchyPage() {
  const fetchFn = useServerFn(getHierarchy);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<HierarchyMember | null>(null);

  const query = useQuery({
    queryKey: ["hierarchy"],
    queryFn: () => fetchFn({ data: {} }),
  });

  const tree = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    const byManager: Record<string, HierarchyMember[]> = {};
    const roots: HierarchyMember[] = [];
    data.members.forEach((m) => {
      if (m.manager_id && data.members.some((x) => x.member_id === m.manager_id)) {
        (byManager[m.manager_id] ??= []).push(m);
      } else {
        roots.push(m);
      }
    });
    const rows: { member: HierarchyMember; depth: number }[] = [];
    function walk(list: HierarchyMember[], depth: number) {
      list
        .sort((a, b) => a.hierarchy_level - b.hierarchy_level || a.full_name.localeCompare(b.full_name))
        .forEach((m) => {
          rows.push({ member: m, depth });
          walk(byManager[m.member_id] ?? [], depth + 1);
        });
    }
    walk(roots, 0);
    return rows;
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Vous n'appartenez à aucune entreprise. Créez-en une ou rejoignez-en une pour
              construire votre organigramme.
            </p>
            <Button asChild>
              <Link to="/company">Aller à mon entreprise</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = query.data;
  const canEditLevels = data.my_level === 1 || data.is_owner;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Organigramme</h1>
        <p className="text-muted-foreground mt-1">
          {data.company_name} — suivi du rapport du jour par collaborateur.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {data.members.length} membre(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {tree.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun autre membre. Invitez vos collaborateurs depuis la page Entreprise.
            </p>
          )}
          {tree.map(({ member, depth }) => (
            <div
              key={member.member_id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2"
              style={{ marginLeft: depth * 20 }}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {member.full_name}
                  {member.member_id === data.my_member_id && (
                    <span className="text-xs text-muted-foreground"> (vous)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {levelLabel(member.hierarchy_level)}
                  {member.position_title ? ` · ${member.position_title}` : ""}
                  {member.department ? ` · ${member.department}` : ""}
                </div>
              </div>
              <StateChip state={member.today_state} />
              <span className="text-xs text-muted-foreground">{member.reports_count} rapport(s)</span>
              {member.today_report_id && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/reports/$id" params={{ id: member.today_report_id }}>
                    Voir
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(member)}
                aria-label={`Modifier ${member.full_name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {editing && (
        <EditMemberDialog
          member={editing}
          members={data.members}
          canEditLevels={canEditLevels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
            queryClient.invalidateQueries({ queryKey: ["team-compliance"] });
          }}
        />
      )}
    </div>
  );
}

function EditMemberDialog({
  member,
  members,
  canEditLevels,
  onClose,
  onSaved,
}: {
  member: HierarchyMember;
  members: HierarchyMember[];
  canEditLevels: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updateMemberHierarchy);
  const [level, setLevel] = useState(String(member.hierarchy_level));
  const [position, setPosition] = useState(member.position_title);
  const [department, setDepartment] = useState(member.department);
  const [managerId, setManagerId] = useState(member.manager_id ?? "none");

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          memberId: member.member_id,
          ...(canEditLevels ? { hierarchyLevel: Number(level) } : {}),
          positionTitle: position,
          department,
          managerId: managerId === "none" ? null : managerId,
        },
      }),
    onSuccess: () => {
      toast.success("Membre mis à jour");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Mise à jour impossible"),
  });

  const managerOptions = members.filter(
    (m) => m.member_id !== member.member_id && m.hierarchy_level < Number(level),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Niveau hiérarchique</label>
            <Select value={level} onValueChange={setLevel} disabled={!canEditLevels}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIERARCHY_LEVELS.map((l) => (
                  <SelectItem key={l.level} value={String(l.level)}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!canEditLevels && (
              <p className="text-xs text-muted-foreground">
                Seule la direction générale peut changer les niveaux.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Intitulé du poste</label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Directeur commercial"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Département / service</label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Commercial"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rattaché à</label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun supérieur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun supérieur direct</SelectItem>
                {managerOptions.map((m) => (
                  <SelectItem key={m.member_id} value={m.member_id}>
                    {m.full_name} — {levelLabel(m.hierarchy_level)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
