import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Search,
  Trash2,
  Download,
  Loader2,
  FileText,
} from "lucide-react";
import {
  listFolders,
  createFolder,
  deleteFolder,
  listDocuments,
  createDocument,
  deleteDocument,
  getDocumentDownloadUrl,
} from "@/lib/documents/documents.functions";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
  formatBytes,
} from "@/lib/documents/documents.server";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({
    meta: [
      { title: "Documents — DailyBrief" },
      {
        name: "description",
        content:
          "Bibliothèque de documents d'entreprise : dossiers, catégories, versions et recherche.",
      },
      { property: "og:title", content: "Documents — DailyBrief" },
      {
        property: "og:description",
        content: "Centralisez procédures, contrats et notes internes de votre entreprise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

const MAX_SIZE = 30 * 1024 * 1024;

function DocumentsPage() {
  const qc = useQueryClient();
  const foldersFn = useServerFn(listFolders);
  const docsFn = useServerFn(listDocuments);
  const createFolderFn = useServerFn(createFolder);
  const deleteFolderFn = useServerFn(deleteFolder);
  const createDocFn = useServerFn(createDocument);
  const deleteDocFn = useServerFn(deleteDocument);
  const urlFn = useServerFn(getDocumentDownloadUrl);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("procedure");
  const [visibility, setVisibility] = useState<string>("company");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ["documents", "folders"],
    queryFn: () => foldersFn(),
  });
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", "list", folderId, search],
    queryFn: () => docsFn({ data: { folderId, search: search || undefined } }),
  });

  const addFolder = useMutation({
    mutationFn: () => createFolderFn({ data: { name: newFolder.trim() } }),
    onSuccess: () => {
      setNewFolder("");
      toast.success("Dossier créé.");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const removeFolder = useMutation({
    mutationFn: (id: string) => deleteFolderFn({ data: { id } }),
    onSuccess: () => {
      setFolderId(null);
      toast.success("Dossier supprimé.");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const removeDoc = useMutation({
    mutationFn: (id: string) => deleteDocFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Document supprimé.");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  async function download(id: string) {
    try {
      const { url } = await urlFn({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Téléchargement impossible");
    }
  }

  async function upload() {
    if (!file || title.trim().length < 2) return;
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
      await createDocFn({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          visibility: visibility as "private" | "department" | "company",
          folderId,
          storagePath: path,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || undefined,
        },
      });
      toast.success("Document ajouté.");
      setUploadOpen(false);
      setTitle("");
      setDescription("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <FolderOpen className="h-6 w-6 text-primary" />
            Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            Procédures, contrats, notes internes — classés et partagés en interne.
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-title">Titre</Label>
                <Input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Procédure de caisse 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-desc">Description (facultative)</Label>
                <Textarea
                  id="doc-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label="Catégorie">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {DOCUMENT_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilité</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger aria-label="Visibilité">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Toute l'entreprise</SelectItem>
                      <SelectItem value="department">Mon service</SelectItem>
                      <SelectItem value="private">Privé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-file">Fichier (30 Mo maximum)</Label>
                <Input
                  id="doc-file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                className="w-full"
                disabled={busy || !file || title.trim().length < 2}
                onClick={upload}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Dossiers</p>
            <button
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                folderId === null ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
              onClick={() => setFolderId(null)}
            >
              Tous les documents
            </button>
            {folders.map((f) => (
              <div key={f.id} className="flex items-center gap-1">
                <button
                  className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                    folderId === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                  onClick={() => setFolderId(f.id)}
                >
                  {f.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Supprimer le dossier ${f.name}`}
                  onClick={() => removeFolder.mutate(f.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="Nouveau dossier"
                className="h-9"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0"
                aria-label="Créer le dossier"
                disabled={!newFolder.trim() || addFolder.isPending}
                onClick={() => addFolder.mutate()}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un document…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="h-24 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ) : docs.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Aucun document ici pour l'instant.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/documents/$id"
                        params={{ id: d.id }}
                        className="truncate font-medium hover:underline"
                      >
                        {d.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category} ·{" "}
                        {formatBytes(d.size_bytes)} · v{d.version} ·{" "}
                        {d.author_name ?? "—"}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {DOCUMENT_VISIBILITY_LABELS[d.visibility] ?? d.visibility}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => download(d.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${d.title}`}
                      onClick={() => removeDoc.mutate(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
