import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin.functions";
import { globalSearch, type SearchResult } from "@/lib/search.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  FileText,
  Euro,
  Package,
  Search,
  FileSignature,
  Loader2,
} from "lucide-react";

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const KIND_ICONS = {
  report: FileText,
  minute: FileSignature,
  member: Users,
  company: Building2,
} as const;

const KIND_LABELS = {
  report: "Rapports",
  minute: "Procès-verbaux",
  member: "Employés",
  company: "Entreprises",
} as const;

export function DashboardPanel() {
  const fn = useServerFn(getAdminDashboard);
  const searchFn = useServerFn(globalSearch);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fn(),
  });

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["admin-dashboard-search", debouncedQ],
    queryFn: () => searchFn({ data: { query: debouncedQ } }),
    enabled: debouncedQ.length >= 2,
    staleTime: 15_000,
  });

  const grouped = groupResults(results ?? []);

  const cards = data
    ? [
        { label: "Entreprises", value: data.companiesCount, icon: Building2 },
        { label: "Utilisateurs", value: data.usersCount, icon: Users },
        { label: "Rapports (ce mois-ci)", value: data.reportsThisMonth, icon: FileText },
        { label: "Revenus (mois en cours)", value: formatEur(data.revenueMtdCents), icon: Euro },
        { label: "Plans actifs", value: data.activePlans, icon: Package },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> Recherche globale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher rapports, PV, employés, entreprises…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {debouncedQ.length >= 2 && (
            <div className="rounded-md border bg-muted/20 p-3">
              {isFetching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
                </div>
              ) : (results?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun résultat.</p>
              ) : (
                <div className="space-y-3">
                  {(Object.keys(grouped) as Array<keyof typeof grouped>).map((kind) => {
                    const items = grouped[kind];
                    if (!items || items.length === 0) return null;
                    const Icon = KIND_ICONS[kind];
                    return (
                      <div key={kind}>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          {KIND_LABELS[kind]}
                        </div>
                        <div className="space-y-1">
                          {items.map((r) => (
                            <button
                              key={`${r.kind}-${r.id}`}
                              type="button"
                              onClick={() => navigate({ to: r.href })}
                              className="flex items-center gap-2 w-full text-left rounded p-2 hover:bg-accent transition-colors"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm">{r.title}</div>
                                {r.subtitle && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {r.subtitle}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="text-2xl font-bold">{value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function groupResults(results: SearchResult[]) {
  const out: Record<SearchResult["kind"], SearchResult[]> = {
    report: [],
    minute: [],
    member: [],
    company: [],
  };
  for (const r of results) out[r.kind].push(r);
  return out;
}
