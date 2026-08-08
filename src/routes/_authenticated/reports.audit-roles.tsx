import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRoleAudit } from "@/lib/role-audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { levelLabel } from "@/lib/reports.types";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  ArrowLeft,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/audit-roles")({
  head: () => ({
    meta: [
      { title: "Audit des rôles et politiques — DailyBrief" },
      {
        name: "description",
        content:
          "Vérifiez la correspondance entre les rôles hiérarchiques et les politiques d'accès appliquées en base.",
      },
      { property: "og:title", content: "Audit des rôles et politiques — DailyBrief" },
      {
        property: "og:description",
        content:
          "Contrôle de cohérence entre l'organigramme et la règle d'accès is_manager_of.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoleAuditPage,
});

const PERM_LABELS: { key: string; label: string }[] = [
  { key: "view_own", label: "Voir mes rapports" },
  { key: "view_team", label: "Voir mon équipe" },
  { key: "view_company", label: "Voir toute l'entreprise" },
  { key: "validate", label: "Valider / rejeter" },
  { key: "delete_own", label: "Supprimer mes rapports" },
  { key: "delete_others", label: "Supprimer ceux des autres" },
  { key: "manage_hierarchy", label: "Gérer l'organigramme" },
  { key: "direction_kpis", label: "Vue direction (KPIs)" },
];

function RoleAuditPage() {
  const auditFn = useServerFn(getRoleAudit);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["role-audit"],
    queryFn: () => auditFn(),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Audit des rôles
          </h1>
          <p className="text-muted-foreground mt-1">
            Correspondance entre les rôles hiérarchiques et les règles d'accès appliquées en
            base (<code className="text-xs">is_manager_of</code>).
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux rapports
          </Link>
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 rounded-lg" />}
      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Impossible de charger l'audit.
          </CardContent>
        </Card>
      )}
      {data === null && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Vous n'appartenez à aucune entreprise : aucun rôle hiérarchique à auditer.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Mon rôle effectif
                <Badge variant="default">{levelLabel(data.my_level)}</Badge>
                {data.is_owner && <Badge variant="secondary">Propriétaire</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {data.my_role_label}
                {data.my_position ? ` · ${data.my_position}` : ""} — {data.company_name}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERM_LABELS.map((p) => {
                  const on = (data.permissions as any)[p.key] === true;
                  return (
                    <div
                      key={p.key}
                      className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
                    >
                      {on ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <MinusCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={on ? "" : "text-muted-foreground"}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Portée attendue vs observée ({data.scope.length} membres)
                {data.mismatches > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {data.mismatches} écart(s)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Cohérent
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground [&_th]:whitespace-nowrap">
                    <th className="py-2 pr-3">Membre</th>
                    <th className="py-2 pr-3">Niveau</th>
                    <th className="py-2 pr-3">Attendu</th>
                    <th className="py-2 pr-3">Observé en base</th>
                    <th className="py-2">Rapports lus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scope.map((s) => (
                    <tr key={s.member_id} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.position_title || "—"}
                          {s.department ? ` · ${s.department}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{levelLabel(s.hierarchy_level)}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {s.expected_visible ? "Visible" : "Masqué"}
                      </td>
                      <td className="py-2 pr-3">
                        {s.observed === "ok" && (
                          <span className="text-primary">Conforme</span>
                        )}
                        {s.observed === "mismatch" && (
                          <span className="text-destructive font-medium">Écart</span>
                        )}
                        {s.observed === "no_data" && (
                          <span className="text-muted-foreground">
                            Aucun rapport pour conclure
                          </span>
                        )}
                      </td>
                      <td className="py-2">{s.reports_seen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" /> Politiques appliquées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.policies.map((p) => (
                <div key={`${p.table}-${p.policy}`} className="rounded border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {p.table}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.policy}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">{p.applies_to}</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 text-[11px] font-mono">
                    {p.rule}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
