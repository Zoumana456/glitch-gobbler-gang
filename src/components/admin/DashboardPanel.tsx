import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, FileText, Euro, ShieldCheck, Package } from "lucide-react";

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function DashboardPanel() {
  const fn = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fn(),
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Chargement…</div>;

  const cards = [
    { label: "Entreprises", value: data.companiesCount, icon: Building2 },
    { label: "Utilisateurs", value: data.usersCount, icon: Users },
    { label: "Rapports (ce mois-ci)", value: data.reportsThisMonth, icon: FileText },
    { label: "Revenus (mois en cours)", value: formatEur(data.revenueMtdCents), icon: Euro },
    { label: "Vérifications en attente", value: data.pendingVerifications, icon: ShieldCheck, alert: data.pendingVerifications > 0 },
    { label: "Plans actifs", value: data.activePlans, icon: Package },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(({ label, value, icon: Icon, alert }) => (
        <Card key={label} className={alert ? "border-orange-500/60" : ""}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${alert ? "bg-orange-500/10" : "bg-primary/10"}`}>
              <Icon className={`h-5 w-5 ${alert ? "text-orange-500" : "text-primary"}`} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold">{value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
