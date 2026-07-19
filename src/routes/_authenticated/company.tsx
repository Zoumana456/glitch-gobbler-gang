import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  getMyCompany,
  createCompany,
  inviteEmployee,
  createEmployeeDirect,
  removeEmployee,
  listInvitations,
  revokeInvitation,
  getCompanyDashboard,
  getCompanyDailyStatus,
} from "@/lib/company.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  UserPlus,
  Users,
  Trash2,
  Copy,
  ExternalLink,
  Activity,
  CalendarCheck2,
  CircleCheck,
  CircleAlert,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { formatLongDate } from "@/lib/date-utils";
import { RequestVerificationDialog } from "@/components/RequestVerificationDialog";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const searchSchema = z.object({
  date: fallback(z.string(), todayISO()).default(todayISO()),
});

export const Route = createFileRoute("/_authenticated/company")({
  validateSearch: zodValidator(searchSchema),
  component: CompanyPage,
});

function CompanyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { date } = Route.useSearch();
  const getMyCompanyFn = useServerFn(getMyCompany);
  const listInvsFn = useServerFn(listInvitations);
  const getDashFn = useServerFn(getCompanyDashboard);
  const createCompanyFn = useServerFn(createCompany);
  const dailyFn = useServerFn(getCompanyDailyStatus);

  const [thresholdDays, setThresholdDays] = useState<3 | 4>(() => {
    if (typeof window === "undefined") return 3;
    const v = window.localStorage.getItem("company:inactivity-threshold");
    return v === "4" ? 4 : 3;
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ["my-company", thresholdDays],
    queryFn: () => getMyCompanyFn({ data: { inactiveThresholdDays: thresholdDays } }),
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ["company-invitations"],
    queryFn: () => listInvsFn(),
    enabled: !!company?.is_owner,
  });
  const { data: dashboard } = useQuery({
    queryKey: ["company-dashboard", thresholdDays],
    queryFn: () => getDashFn({ data: { inactiveThresholdDays: thresholdDays } }),
    enabled: !!company?.is_owner,
  });
  const { data: daily = [] } = useQuery({
    queryKey: ["company-daily", date],
    queryFn: () => dailyFn({ data: { date } }),
    enabled: !!company?.is_owner,
  });

  const [newCompanyName, setNewCompanyName] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [protectedReason, setProtectedReason] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");

  function changeThreshold(v: 3 | 4) {
    setThresholdDays(v);
    try {
      window.localStorage.setItem("company:inactivity-threshold", String(v));
    } catch {}
  }

  function focusInactive() {
    setActivityFilter("inactive");
    setTimeout(() => {
      document
        .getElementById("employees-table")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const createMut = useMutation({
    mutationFn: (name: string) => createCompanyFn({ data: { name } }),
    onSuccess: (res) => {
      if (res?.needsVerification) {
        setVerifyOpen(true);
        toast.info(res.reason ?? "Nom réservé — vérification requise.");
        return;
      }
      toast.success("Entreprise créée");
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "Erreur");
      if (msg.includes("protégé") || msg.toLowerCase().includes("vérification")) {
        setVerifyOpen(true);
        toast.info("Ce nom est réservé — ouvrez une demande de vérification.");
        return;
      }
      toast.error(msg);
    },
  });

  if (isLoading) return <div className="p-8">Chargement...</div>;

  if (!company) {
    return (
      <div className="max-w-xl mx-auto p-6 md:p-10 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Créer votre entreprise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Devenez DG d'une entreprise pour inviter des employés et consulter
              tous leurs rapports.
            </p>
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'entreprise</Label>
              <Input
                id="name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ma société"
              />
            </div>
            <Button
              onClick={() => newCompanyName.trim() && createMut.mutate(newCompanyName.trim())}
              disabled={!newCompanyName.trim() || createMut.isPending}
            >
              Créer l'entreprise
            </Button>
          </CardContent>
        </Card>
        <RequestVerificationDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          companyName={newCompanyName.trim()}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rejoindre une entreprise</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Vous êtes employé ? Demandez à votre DG un lien d'invitation.
              Ouvrez-le pour rejoindre l'espace de votre entreprise.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!company.is_owner) {
    return (
      <div className="max-w-xl mx-auto p-6 md:p-10">
        <Card>
          <CardHeader>
            <CardTitle>Entreprise : {company.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vous êtes membre de cette entreprise. Le DG a accès à vos rapports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inactiveIds = new Set(dashboard?.inactive ?? []);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.seats_used} / {company.seat_limit} sièges utilisés
          </p>
        </div>
        <InviteDialog />
      </header>

      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Rapports ce mois-ci" value={dashboard.totalMonth} />
          <StatCard
            label={`Employés actifs (≤${thresholdDays}j)`}
            value={company.members.filter((m) => m.role === "employee" && m.activity_status === "active").length}
          />
          <StatCard
            label={`Employés inactifs (>${thresholdDays}j)`}
            value={company.members.filter((m) => m.role === "employee" && m.activity_status === "inactive").length}
          />
        </div>
      )}


      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Statut quotidien</TabsTrigger>
          <TabsTrigger value="employees">Employés</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck2 className="h-5 w-5" /> Rapports du{" "}
                  {formatLongDate(date)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      navigate({
                        to: "/company",
                        search: {
                          date: `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`,
                        },
                      });
                    }}
                  >
                    Hier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({ to: "/company", search: { date: todayISO() } })
                    }
                  >
                    Aujourd'hui
                  </Button>
                  <Input
                    type="date"
                    value={date}
                    className="w-auto"
                    onChange={(e) =>
                      navigate({
                        to: "/company",
                        search: { date: e.target.value || todayISO() },
                      })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {daily.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun employé.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2">Employé</th>
                        <th className="py-2">Email</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Nb rapports</th>
                        <th className="py-2">Dernier rapport</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily
                        .filter((r) => r.role === "employee")
                        .map((r) => (
                          <tr key={r.user_id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{r.full_name || "—"}</td>
                            <td className="py-2 text-muted-foreground">{r.email}</td>
                            <td className="py-2">
                              {r.status === "done" ? (
                                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  <CircleCheck className="h-3 w-3" /> Fait
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                  <CircleAlert className="h-3 w-3" /> Manquant
                                </span>
                              )}
                            </td>
                            <td className="py-2">{r.reports_count}</td>
                            <td className="py-2 text-muted-foreground">
                              {r.last_report_at
                                ? new Date(r.last_report_at).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                            <td className="py-2 text-right">
                              <Button asChild size="sm" variant="ghost">
                                <Link
                                  to="/company/employees/$id"
                                  params={{ id: r.user_id }}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="mt-4 space-y-4">
          <EmployeesSummary
            total={company.members.filter((m) => m.role === "employee").length}
            active={company.members.filter((m) => m.role === "employee" && m.activity_status === "active").length}
            inactive={company.members.filter((m) => m.role === "employee" && m.activity_status === "inactive").length}
            thresholdDays={thresholdDays}
            onChangeThreshold={changeThreshold}
            onFocusInactive={focusInactive}
          />
          <Card id="employees-table">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Employés
                </CardTitle>
                <EmployeeFilter
                  value={activityFilter}
                  onChange={setActivityFilter}
                  counts={{
                    all: company.members.filter((m) => m.role === "employee").length,
                    active: company.members.filter((m) => m.role === "employee" && m.activity_status === "active").length,
                    inactive: company.members.filter((m) => m.role === "employee" && m.activity_status === "inactive").length,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Un employé est marqué inactif après plus de <strong>{thresholdDays} jours</strong> sans nouveau rapport.
              </p>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Nom</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Rapports</th>
                      <th className="py-2">Dernier rapport</th>
                      <th className="py-2">Statut</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.members
                      .filter((m) => {
                        if (m.role !== "employee") return activityFilter === "all";
                        if (activityFilter === "all") return true;
                        return m.activity_status === activityFilter;
                      })
                      .map((m) => (
                      <tr key={m.user_id} className="border-b last:border-0">
                        <td className="py-2">
                          {m.full_name || "—"}{" "}
                          {m.role === "owner" && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">
                              DG
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">{m.email}</td>
                        <td className="py-2">{m.reports_count}</td>
                        <td className="py-2 text-muted-foreground">
                          {m.last_report_at ? formatLongDate(m.last_report_at) : "Jamais"}
                        </td>
                        <td className="py-2">
                          {m.role === "employee" && m.activity_status === "inactive" ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded w-fit"
                              title={`Seuil : plus de ${thresholdDays} j sans rapport`}
                            >
                              <CircleAlert className="h-3 w-3" />
                              Inactif{m.days_since_last_report !== null ? ` — ${m.days_since_last_report} j` : ""}
                            </span>

                          ) : m.role === "employee" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded w-fit">
                              <Activity className="h-3 w-3" /> Actif
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right">
                          {m.role === "employee" && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigate({
                                    to: "/company/employees/$id",
                                    params: { id: m.user_id },
                                  })
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Rapports
                              </Button>
                              <RemoveMemberButton
                                userId={m.user_id}
                                name={m.full_name || m.email}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations
                .filter((i: any) => i.status === "pending")
                .map((inv: any) => (
                  <InvitationRow key={inv.id} inv={inv} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function InviteDialog() {
  const queryClient = useQueryClient();
  const inviteFn = useServerFn(inviteEmployee);
  const createFn = useServerFn(createEmployeeDirect);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directName, setDirectName] = useState("");

  const inviteMut = useMutation({
    mutationFn: (e: string) => inviteFn({ data: { email: e } }),
    onSuccess: (res: any) => {
      const link = `${window.location.origin}/invite/${res.token}`;
      navigator.clipboard?.writeText(link);
      toast.success("Invitation créée — lien copié dans le presse-papiers");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["company-invitations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: { email: directEmail, password: directPassword, fullName: directName },
      }),
    onSuccess: () => {
      toast.success("Compte employé créé");
      setDirectEmail("");
      setDirectPassword("");
      setDirectName("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" /> Ajouter un employé
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un employé</DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email ou créez directement le compte.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="invite">
          <TabsList className="w-full">
            <TabsTrigger value="invite" className="flex-1">Invitation</TabsTrigger>
            <TabsTrigger value="direct" className="flex-1">Création directe</TabsTrigger>
          </TabsList>
          <TabsContent value="invite" className="space-y-3">
            <Label>Email de l'employé</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employe@example.com"
            />
            <Button
              onClick={() => inviteMut.mutate(email)}
              disabled={!email || inviteMut.isPending}
            >
              Générer le lien d'invitation
            </Button>
          </TabsContent>
          <TabsContent value="direct" className="space-y-3">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={directName} onChange={(e) => setDirectName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={directEmail}
                onChange={(e) => setDirectEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe temporaire (8+ caractères)</Label>
              <Input
                type="text"
                value={directPassword}
                onChange={(e) => setDirectPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={() => createMut.mutate()}
              disabled={
                !directEmail || !directPassword || !directName || createMut.isPending
              }
            >
              Créer le compte
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InvitationRow({ inv }: { inv: any }) {
  const queryClient = useQueryClient();
  const revokeFn = useServerFn(revokeInvitation);
  const link = `${window.location.origin}/invite/${inv.token}`;
  return (
    <div className="flex items-center justify-between gap-2 border rounded p-2">
      <div className="min-w-0">
        <div className="font-medium truncate">{inv.email}</div>
        <div className="text-xs text-muted-foreground">
          Expire le {formatLongDate(inv.expires_at)}
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard?.writeText(link);
            toast.success("Lien copié");
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1" /> Lien
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await revokeFn({ data: { id: inv.id } });
            queryClient.invalidateQueries({ queryKey: ["company-invitations"] });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  const queryClient = useQueryClient();
  const removeFn = useServerFn(removeEmployee);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        if (!confirm(`Retirer ${name} de l'entreprise ?`)) return;
        try {
          await removeFn({ data: { userId } });
          toast.success("Employé retiré");
          queryClient.invalidateQueries({ queryKey: ["my-company"] });
        } catch (e: any) {
          toast.error(e?.message ?? "Erreur");
        }
      }}
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}

function EmployeeFilter({
  value,
  onChange,
  counts,
}: {
  value: "all" | "active" | "inactive";
  onChange: (v: "all" | "active" | "inactive") => void;
  counts: { all: number; active: number; inactive: number };
}) {
  const items: { key: "all" | "active" | "inactive"; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "active", label: "Actifs", count: counts.active },
    { key: "inactive", label: "Inactifs", count: counts.inactive },
  ];
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={
            "px-3 py-1 text-xs rounded-sm transition-colors " +
            (value === it.key
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {it.label}
          <span className="ml-1.5 text-[10px] opacity-70">({it.count})</span>
        </button>
      ))}
    </div>
  );
}

function EmployeesSummary({
  total,
  active,
  inactive,
  thresholdDays,
  onChangeThreshold,
  onFocusInactive,
}: {
  total: number;
  active: number;
  inactive: number;
  thresholdDays: 3 | 4;
  onChangeThreshold: (v: 3 | 4) => void;
  onFocusInactive: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Vue d'ensemble de l'activité de vos employés.
          </div>
          <div className="inline-flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Seuil d'inactivité :</span>
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
              {[3, 4].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChangeThreshold(d as 3 | 4)}
                  className={
                    "px-2.5 py-1 rounded-sm transition-colors " +
                    (thresholdDays === d
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {d} j
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Total employés
            </div>
            <div className="text-2xl font-semibold mt-1">{total}</div>
          </div>
          <div className="rounded-lg border p-3 bg-green-50/60">
            <div className="text-xs text-green-800 flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Actifs
            </div>
            <div className="text-2xl font-semibold mt-1 text-green-900">{active}</div>
            <div className="text-[11px] text-green-800/70 mt-0.5">
              rapport dans les {thresholdDays} derniers jours
            </div>
          </div>
          <button
            type="button"
            onClick={onFocusInactive}
            className="rounded-lg border p-3 bg-orange-50/60 text-left hover:bg-orange-100/60 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            <div className="text-xs text-orange-800 flex items-center gap-1">
              <CircleAlert className="h-3.5 w-3.5" /> Inactifs
            </div>
            <div className="text-2xl font-semibold mt-1 text-orange-900">{inactive}</div>
            <div className="text-[11px] text-orange-800/70 mt-0.5">
              &gt; {thresholdDays} j sans rapport — cliquer pour filtrer
            </div>
          </button>
        </div>
        {inactive > 0 && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onFocusInactive}>
              <CircleAlert className="h-4 w-4 mr-2" /> Voir les {inactive} inactif{inactive > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
