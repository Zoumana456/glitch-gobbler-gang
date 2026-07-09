import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReports, deleteReport, getReport } from "@/lib/reports.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatLongDate } from "@/lib/date-utils";
import { downloadReportPdf, shareReportPdf, downloadReportsBundle } from "@/lib/pdf-utils";
import {
  Plus,
  FileText,
  Download,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Rapports journaliers — Lovable Rapports" },
      {
        name: "description",
        content: "Tous les rapports d'activités de votre équipe, triés par date.",
      },
    ],
  }),
  component: ReportsListPage,
});

function ReportsListPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useServerFn(listReports);
  const fetchOne = useServerFn(getReport);
  const del = useServerFn(deleteReport);

  const query = useQuery({
    queryKey: ["reports"],
    queryFn: () => list(),
  });

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.title, r.intro, r.author_name].filter(Boolean).some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }, [query.data, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: typeof filtered }>();
    for (const r of filtered) {
      const d = parseISO(r.report_date);
      const key = format(d, "yyyy-MM");
      const label = format(d, "LLLL yyyy", { locale: fr });
      const cap = label.charAt(0).toUpperCase() + label.slice(1);
      if (!map.has(key)) map.set(key, { label: cap, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, v]) => ({ key, ...v }));
  }, [filtered]);


  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Rapport supprimé");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible"),
  });

  async function handleDownloadOne(id: string) {
    try {
      const r = await fetchOne({ data: { id } });
      await downloadReportPdf(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    }
  }

  async function handleShareOne(id: string) {
    try {
      const r = await fetchOne({ data: { id } });
      await shareReportPdf(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Partage impossible");
    }
  }

  async function handleBulkDownload() {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const reports = await Promise.all(
        Array.from(selected).map((id) => fetchOne({ data: { id } })),
      );
      await downloadReportsBundle(reports);
      toast.success(`${reports.length} rapport(s) téléchargé(s)`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    } finally {
      setBulkLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rapports journaliers</h1>
          <p className="text-muted-foreground mt-1">
            Consultez tous les rapports de l'équipe, triés par date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkDownload}
              disabled={bulkLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger ({selected.size})
            </Button>
          )}
          <Button asChild>
            <Link to="/reports/new">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau rapport
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative mb-6 max-w-lg">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre, intro ou auteur…"
          className="pl-9"
        />
      </div>

      {query.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      {query.isError && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Impossible de charger les rapports.
          </CardContent>
        </Card>
      )}

      {query.data && query.data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">Aucun rapport pour le moment</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre premier rapport d'activité.
            </p>
            <Button asChild>
              <Link to="/reports/new">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau rapport
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {query.data && query.data.length > 0 && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun rapport ne correspond à « {search} ».
          </CardContent>
        </Card>
      )}

      {grouped.map((group) => (
        <section key={group.key} className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 pb-2 border-b border-border">
            {group.label}
            <span className="ml-2 text-xs font-normal normal-case tracking-normal">
              ({group.items.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((r) => {
              const isMine = r.author_id === user.id;
              const isSel = selected.has(r.id);
              return (
                <Card
                  key={r.id}
                  className={cn(
                    "group transition-shadow hover:shadow-md relative flex flex-col",
                    isSel && "ring-2 ring-primary",
                  )}
                >
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggle(r.id)}
                          aria-label="Sélectionner"
                        />
                        <span className="text-xs font-medium text-primary">
                          {formatLongDate(r.report_date)}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate({
                                to: "/reports/$id",
                                params: { id: r.id },
                              })
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Voir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadOne(r.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShareOne(r.id)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Partager
                          </DropdownMenuItem>
                          {isMine && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate({
                                    to: "/reports/$id/edit",
                                    params: { id: r.id },
                                  })
                                }
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setToDelete(r.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Link
                      to="/reports/$id"
                      params={{ id: r.id }}
                      className="text-lg font-semibold leading-snug hover:text-primary transition-colors line-clamp-2"
                    >
                      {r.title}
                    </Link>
                    {r.intro && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-1">
                        {r.intro}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                      Par <span className="font-medium text-foreground">{r.author_name}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}


      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le rapport et toutes ses images seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMut.mutate(toDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
