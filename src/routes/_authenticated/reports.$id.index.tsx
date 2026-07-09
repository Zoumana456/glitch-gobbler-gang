import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReport, deleteReport } from "@/lib/reports.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Download,
  Share2,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { formatLongDate } from "@/lib/date-utils";
import { Lightbox } from "@/components/Lightbox";
import { useState } from "react";
import { toast } from "sonner";
import { downloadReportPdf, shareReportPdf } from "@/lib/pdf-utils";
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

export const Route = createFileRoute("/_authenticated/reports/$id/")({
  head: ({ params }) => ({
    meta: [{ title: `Rapport — Lovable Rapports`, }, { name: "robots", content: "noindex" }],
  }),
  component: ReportDetailPage,
});

function RichText({ text }: { text: string }) {
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-3 text-foreground/90 leading-relaxed">
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  );
}

function ReportDetailPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOne = useServerFn(getReport);
  const del = useServerFn(deleteReport);

  const query = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const [lightbox, setLightbox] = useState<{ images: { url: string; id: string }[]; index: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Rapport supprimé");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      navigate({ to: "/reports" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible"),
  });

  async function handleDownload() {
    if (!query.data) return;
    setDownloading(true);
    try {
      await downloadReportPdf(query.data);
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    } finally {
      setDownloading(false);
    }
  }
  async function handleShare() {
    if (!query.data) return;
    setSharing(true);
    try {
      await shareReportPdf(query.data);
    } catch (e: any) {
      toast.error(e?.message ?? "Partage impossible");
    } finally {
      setSharing(false);
    }
  }

  if (query.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <Button variant="ghost" asChild>
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
        <Card className="mt-4">
          <CardContent className="py-8 text-center text-destructive">
            Rapport introuvable.
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = query.data;
  const isMine = r.author_id === user.id;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={handleShare} disabled={sharing}>
            {sharing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Partager
          </Button>
          {isMine && (
            <>
              <Button variant="outline" asChild>
                <Link to="/reports/$id/edit" params={{ id: r.id }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </Link>
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-border pb-4">
        <div className="text-sm text-primary font-medium">
          {formatLongDate(r.report_date)}
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">{r.title}</h1>
        <div className="text-sm text-muted-foreground mt-2">
          Par <span className="font-medium text-foreground">{r.author_name}</span>
        </div>
      </div>

      {r.intro && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Introduction</h2>
          <RichText text={r.intro} />
        </section>
      )}

      {r.sections.map((s) => (
        <section key={s.id} className="space-y-3">
          <h2 className="text-xl font-semibold">{s.title || "Section"}</h2>
          {s.description && <RichText text={s.description} />}
          {s.bullets.length > 0 && (
            <ul className="list-disc pl-6 space-y-2">
              {s.bullets.map((b) => (
                <li key={b.id}>{b.content}</li>
              ))}
            </ul>
          )}
          {s.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {s.images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() =>
                    setLightbox({
                      images: s.images.map((i) => ({ id: i.id, url: i.url })),
                      index: idx,
                    })
                  }
                  className="aspect-square rounded-md overflow-hidden bg-muted border border-border"
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      {r.conclusion && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Conclusion</h2>
          <RichText text={r.conclusion} />
        </section>
      )}

      {r.general_images.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Images</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {r.general_images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() =>
                  setLightbox({
                    images: r.general_images.map((i) => ({ id: i.id, url: i.url })),
                    index: idx,
                  })
                }
                className="aspect-square rounded-md overflow-hidden bg-muted border border-border"
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
