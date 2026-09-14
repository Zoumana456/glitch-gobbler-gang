import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Upload, Loader2, FileText } from "lucide-react";
import {
  getDocument,
  getDocumentDownloadUrl,
  addDocumentVersion,
} from "@/lib/documents/documents.functions";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
  formatBytes,
} from "@/lib/documents/documents.server";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({
    meta: [
      { title: "Document — DailyBrief" },
      {
        name: "description",
        content: "Détail d'un document d'entreprise et historique de ses versions.",
      },
      { property: "og:title", content: "Document — DailyBrief" },
      {
        property: "og:description",
        content: "Consultez, téléchargez et versionnez vos documents internes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentDetailPage,
});

const MAX_SIZE = 30 * 1024 * 1024;

function DocumentDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getDocument);
  const urlFn = useServerFn(getDocumentDownloadUrl);
  const versionFn = useServerFn(addDocumentVersion);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", "detail", id],
    queryFn: () => getFn({ data: { id } }),
  });

  async function download(versionId?: string) {
    try {
      const { url } = await urlFn({ data: { id, versionId } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    }
  }

  async function uploadNewVersion(file: File) {
    if (file.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux (30 Mo maximum).");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expirée.");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("ged-documents")
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const { version } = await versionFn({
        data: {
          id,
          storagePath: path,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || undefined,
        },
      });
      toast.success(`Version ${version} enregistrée.`);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );

  if (!data)
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 md:p-10">
        <p className="text-sm text-muted-foreground">
          Ce document est introuvable ou vous n'y avez pas accès.
        </p>
        <Button asChild variant="outline">
          <Link to="/documents">Retour aux documents</Link>
        </Button>
      </div>
    );

  const doc = data.document;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/documents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux documents
        </Link>
      </Button>

      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <FileText className="h-6 w-6 text-primary" />
          {doc.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
          </Badge>
          <Badge variant="outline">
            {DOCUMENT_VISIBILITY_LABELS[doc.visibility] ?? doc.visibility}
          </Badge>
          <span>
            v{doc.version} · {formatBytes(doc.size_bytes)} · déposé par{" "}
            {doc.author_name ?? "—"}
          </span>
        </div>
        {doc.description && <p className="text-sm">{doc.description}</p>}
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => download()}>
          <Download className="mr-2 h-4 w-4" />
          Télécharger la dernière version
        </Button>
        <div>
          <Label htmlFor="new-version" className="sr-only">
            Nouvelle version
          </Label>
          <Input
            id="new-version"
            type="file"
            className="w-auto"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadNewVersion(f);
            }}
          />
        </div>
        {busy && (
          <span className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Envoi…
          </span>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4" />
            Historique des versions
          </p>
          {data.versions.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm first:border-0 first:pt-0"
            >
              <span className="font-medium">v{v.version}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {v.file_name} · {formatBytes(v.size_bytes)} ·{" "}
                {new Date(v.created_at).toLocaleDateString("fr-FR")} ·{" "}
                {v.author_name ?? "—"}
              </span>
              <Button variant="outline" size="sm" onClick={() => download(v.id)}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
