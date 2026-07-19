import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEmployeeReports } from "@/lib/company.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Eye } from "lucide-react";
import { formatLongDate } from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/company/employees/$id")({
  component: EmployeePage,
});

function EmployeePage() {
  const { id } = Route.useParams();
  const listFn = useServerFn(listEmployeeReports);
  const { data, isLoading } = useQuery({
    queryKey: ["employee-reports", id],
    queryFn: () => listFn({ data: { employeeId: id } }),
  });

  if (isLoading) return <div className="p-8">Chargement...</div>;
  if (!data) return <div className="p-8">Employé introuvable</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <Link to="/company" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'entreprise
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{data.employee.name}</h1>
        <p className="text-sm text-muted-foreground">{data.employee.email}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Rapports ({data.reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rapport pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {data.reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatLongDate(r.report_date)}
                    </div>
                    {r.intro && (
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {r.intro}
                      </div>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/reports/$id" params={{ id: r.id }}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Voir
                    </Link>
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
