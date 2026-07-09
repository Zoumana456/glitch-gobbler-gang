import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertReport } from "@/lib/reports.functions";
import { extractReportFromPdf } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DictationButton } from "./DictationButton";
import { Lightbox } from "./Lightbox";
import { formatShortDate, todayIso } from "@/lib/date-utils";
import {
  ArrowLeft,
  CalendarIcon,
  Download,
  Trash2,
  Plus,
  Upload,
  Loader2,
  FileUp,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fr } from "date-fns/locale";
import { parseISO, format } from "date-fns";
import type { LoadedReport } from "@/lib/reports.types";

type FormBullet = { key: string; content: string };
type FormImage = {
  key: string;
  storage_path: string;
  url: string;
  caption: string;
  uploading?: boolean;
};
type FormSection = {
  key: string;
  title: string;
  description: string;
  bullets: FormBullet[];
  images: FormImage[];
};

type FormState = {
  id: string | null;
  report_date: string;
  title: string;
  intro: string;
  conclusion: string;
  sections: FormSection[];
  general_images: FormImage[];
};

let keyCounter = 0;
const nextKey = () => `k${++keyCounter}_${Date.now()}`;

function fromReport(r: LoadedReport): FormState {
  return {
    id: r.id,
    report_date: r.report_date,
    title: r.title,
    intro: r.intro,
    conclusion: r.conclusion,
    sections: r.sections.map((s) => ({
      key: nextKey(),
      title: s.title,
      description: s.description,
      bullets: s.bullets.map((b) => ({ key: nextKey(), content: b.content })),
      images: s.images.map((i) => ({
        key: nextKey(),
        storage_path: i.storage_path,
        url: i.url,
        caption: i.caption ?? "",
      })),
    })),
    general_images: r.general_images.map((i) => ({
      key: nextKey(),
      storage_path: i.storage_path,
      url: i.url,
      caption: i.caption ?? "",
    })),
  };
}

function emptyForm(): FormState {
  return {
    id: null,
    report_date: todayIso(),
    title: "",
    intro: "",
    conclusion: "",
    sections: [
      {
        key: nextKey(),
        title: "Activités réalisées",
        description: "",
        bullets: [],
        images: [],
      },
    ],
    general_images: [],
  };
}

export function ReportForm({ initial }: { initial?: LoadedReport }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertReport);
  const extract = useServerFn(extractReportFromPdf);
  const [form, setForm] = useState<FormState>(() =>
    initial ? fromReport(initial) : emptyForm(),
  );
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: FormImage[]; index: number } | null>(
    null,
  );
  const pdfInput = useRef<HTMLInputElement>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        id: form.id,
        report_date: form.report_date,
        title: form.title.trim(),
        intro: form.intro,
        conclusion: form.conclusion,
        sections: form.sections.map((s, idx) => ({
          title: s.title,
          description: s.description,
          position: idx,
          bullets: s.bullets
            .map((b, bIdx) => ({ content: b.content.trim(), position: bIdx }))
            .filter((b) => b.content.length > 0),
        })),
        images: [
          ...form.sections.flatMap((s, sIdx) =>
            s.images
              .filter((i) => !!i.storage_path && !i.uploading)
              .map((img, pos) => ({
                storage_path: img.storage_path,
                section_index: sIdx,
                position: pos,
                caption: img.caption ?? "",
              })),
          ),
          ...form.general_images
            .filter((i) => !!i.storage_path && !i.uploading)
            .map((img, pos) => ({
              storage_path: img.storage_path,
              section_index: null as number | null,
              position: pos,
              caption: img.caption ?? "",
            })),
        ],
      };
      return upsert({ data: payload });
    },
    onSuccess: (res) => {
      toast.success(form.id ? "Rapport mis à jour" : "Rapport créé");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report", res.id] });
      navigate({ to: "/reports/$id", params: { id: res.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Enregistrement impossible"),
    onSettled: () => setSaving(false),
  });

  function handleSave() {
    if (!form.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setSaving(true);
    saveMut.mutate();
  }

  async function handlePickPdf(file: File) {
    setImporting(true);
    try {
      const base64 = await fileToBase64(file);
      const extracted = await extract({
        data: { pdfBase64: base64, mimeType: file.type || "application/pdf", filename: file.name },
      });
      setForm((prev) => ({
        ...prev,
        title: extracted.title || prev.title,
        intro: extracted.intro || prev.intro,
        conclusion: extracted.conclusion || prev.conclusion,
        sections:
          extracted.sections.length > 0
            ? extracted.sections.map((s) => ({
                key: nextKey(),
                title: s.title,
                description: s.description,
                bullets: s.bullets.map((c) => ({ key: nextKey(), content: c })),
                images: [],
              }))
            : prev.sections,
      }));
      toast.success("Pré-rempli à partir du PDF");
    } catch (e: any) {
      toast.error(e?.message ?? "Extraction impossible");
    } finally {
      setImporting(false);
    }
  }

  async function uploadImage(file: File): Promise<{ storage_path: string; url: string } | null> {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? "anon";
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("report-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error("Envoi image impossible : " + error.message);
      return null;
    }
    const { data: signed } = await supabase.storage
      .from("report-images")
      .createSignedUrl(path, 3600);
    return { storage_path: path, url: signed?.signedUrl ?? "" };
  }

  async function handleAddImages(files: FileList, sectionIdx: number | null) {
    const arr = Array.from(files);
    // Optimistic add with uploading state
    const optimistic: FormImage[] = arr.map((f) => ({
      key: nextKey(),
      storage_path: "",
      url: URL.createObjectURL(f),
      caption: "",
      uploading: true,
    }));
    setForm((prev) => {
      if (sectionIdx === null) {
        return { ...prev, general_images: [...prev.general_images, ...optimistic] };
      }
      const sections = prev.sections.map((s, idx) =>
        idx === sectionIdx ? { ...s, images: [...s.images, ...optimistic] } : s,
      );
      return { ...prev, sections };
    });
    // Upload sequentially
    for (let i = 0; i < arr.length; i++) {
      const res = await uploadImage(arr[i]);
      const opt = optimistic[i];
      setForm((prev) => {
        if (sectionIdx === null) {
          return {
            ...prev,
            general_images: prev.general_images
              .map((img) =>
                img.key === opt.key
                  ? res
                    ? { key: img.key, storage_path: res.storage_path, url: res.url, caption: img.caption }
                    : null
                  : img,
              )
              .filter(Boolean) as FormImage[],
          };
        }
        const sections = prev.sections.map((s, idx) => {
          if (idx !== sectionIdx) return s;
          const images = s.images
            .map((img) =>
              img.key === opt.key
                ? res
                  ? { key: img.key, storage_path: res.storage_path, url: res.url, caption: img.caption }
                  : null
                : img,
            )
            .filter(Boolean) as FormImage[];
          return { ...s, images };
        });
        return { ...prev, sections };
      });
    }
  }

  function removeImage(sectionIdx: number | null, key: string) {
    setForm((prev) => {
      if (sectionIdx === null) {
        return {
          ...prev,
          general_images: prev.general_images.filter((i) => i.key !== key),
        };
      }
      const sections = prev.sections.map((s, idx) =>
        idx === sectionIdx ? { ...s, images: s.images.filter((i) => i.key !== key) } : s,
      );
      return { ...prev, sections };
    });
  }

  function updateImageCaption(sectionIdx: number | null, key: string, caption: string) {
    setForm((prev) => {
      if (sectionIdx === null) {
        return {
          ...prev,
          general_images: prev.general_images.map((i) =>
            i.key === key ? { ...i, caption } : i,
          ),
        };
      }
      const sections = prev.sections.map((s, idx) =>
        idx === sectionIdx
          ? { ...s, images: s.images.map((i) => (i.key === key ? { ...i, caption } : i)) }
          : s,
      );
      return { ...prev, sections };
    });

  function addSection() {
    setForm((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          key: nextKey(),
          title: "",
          description: "",
          bullets: [],
          images: [],
        },
      ],
    }));
  }

  function removeSection(idx: number) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx),
    }));
  }

  function updateSection(idx: number, patch: Partial<FormSection>) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function addBullet(sIdx: number) {
    updateSection(sIdx, {
      bullets: [...form.sections[sIdx].bullets, { key: nextKey(), content: "" }],
    });
  }

  function updateBullet(sIdx: number, bKey: string, content: string) {
    updateSection(sIdx, {
      bullets: form.sections[sIdx].bullets.map((b) =>
        b.key === bKey ? { ...b, content } : b,
      ),
    });
  }

  function removeBullet(sIdx: number, bKey: string) {
    updateSection(sIdx, {
      bullets: form.sections[sIdx].bullets.filter((b) => b.key !== bKey),
    });
  }

  function exportText(text: string, name: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: "/reports" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-xl font-semibold">
          {form.id ? "Modifier le rapport" : "Nouveau rapport"}
        </h1>
        <div className="w-24" />
      </div>

      {/* Import PDF */}
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Importer un PDF</div>
              <p className="text-sm text-muted-foreground">
                Pré-remplit le formulaire à partir d'un rapport existant.
              </p>
            </div>
            <div>
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePickPdf(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => pdfInput.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4 mr-2" />
                )}
                Choisir un PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date + Titre */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Date du rapport</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formatShortDate(form.report_date)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={fr}
                    selected={parseISO(form.report_date)}
                    onSelect={(d) =>
                      d && setForm((p) => ({ ...p, report_date: format(d, "yyyy-MM-dd") }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="title">Titre / objet du rapport</Label>
              <Input
                id="title"
                placeholder="Compte rendu des activités du vendredi 3 juillet"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-base">Introduction</Label>
            <div className="flex items-center gap-2">
              <DictationButton
                label="Dicter l'intro"
                onTranscript={(t) =>
                  setForm((p) => ({ ...p, intro: (p.intro + " " + t).trim() }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => exportText(form.intro, "introduction")}
                title="Télécharger"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Textarea
            rows={4}
            placeholder="Contexte général du rapport…"
            value={form.intro}
            onChange={(e) => setForm((p) => ({ ...p, intro: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {form.sections.map((section, sIdx) => (
          <Card key={section.key}>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <Input
                  className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
                  placeholder="Titre de la section"
                  value={section.title}
                  onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSection(sIdx)}
                  title="Supprimer la section"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <div className="flex items-center gap-2">
                    <DictationButton
                      label="Dicter"
                      onTranscript={(t) =>
                        updateSection(sIdx, {
                          description: (section.description + " " + t).trim(),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => exportText(section.description, `section-${sIdx + 1}`)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Détails de l'activité…"
                  value={section.description}
                  onChange={(e) => updateSection(sIdx, { description: e.target.value })}
                />
              </div>

              {/* Bullets */}
              <div className="space-y-2">
                <Label>Points</Label>
                {section.bullets.map((b) => (
                  <div key={b.key} className="flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    <Input
                      value={b.content}
                      onChange={(e) => updateBullet(sIdx, b.key, e.target.value)}
                      placeholder="Point…"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBullet(sIdx, b.key)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addBullet(sIdx)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Point
                </Button>
              </div>

              {/* Section images */}
              <ImagesGrid
                images={section.images}
                onAdd={(files) => handleAddImages(files, sIdx)}
                onRemove={(k) => removeImage(sIdx, k)}
                onView={(idx) => setLightbox({ images: section.images, index: idx })}
              />
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={addSection} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une section
        </Button>
      </div>

      {/* Conclusion */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-base">Conclusion</Label>
            <div className="flex items-center gap-2">
              <DictationButton
                label="Dicter"
                onTranscript={(t) =>
                  setForm((p) => ({ ...p, conclusion: (p.conclusion + " " + t).trim() }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => exportText(form.conclusion, "conclusion")}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Textarea
            rows={4}
            placeholder="Synthèse et prochaines étapes…"
            value={form.conclusion}
            onChange={(e) => setForm((p) => ({ ...p, conclusion: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* General images */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <Label className="text-base">Images générales</Label>
          <ImagesGrid
            images={form.general_images}
            onAdd={(files) => handleAddImages(files, null)}
            onRemove={(k) => removeImage(null, k)}
            onView={(idx) => setLightbox({ images: form.general_images, index: idx })}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2 sticky bottom-4 bg-background/95 backdrop-blur border border-border rounded-lg p-3">
        <Button variant="outline" onClick={() => navigate({ to: "/reports" })}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {form.id ? "Enregistrer les modifications" : "Créer le rapport"}
        </Button>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images.map((i) => ({ id: i.key, url: i.url }))}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </div>
  );
}

function ImagesGrid({
  images,
  onAdd,
  onRemove,
  onView,
}: {
  images: FormImage[];
  onAdd: (files: FileList) => void;
  onRemove: (key: string) => void;
  onView: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <div
            key={img.key}
            className="relative group aspect-square rounded-md overflow-hidden bg-muted border border-border"
          >
            {img.url && (
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => onView(idx)}
              />
            )}
            {img.uploading && (
              <div className="absolute inset-0 bg-background/60 grid place-items-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(img.key)}
              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Supprimer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="aspect-square rounded-md border-2 border-dashed border-border hover:border-primary hover:text-primary text-muted-foreground grid place-items-center transition-colors"
        >
          <div className="flex flex-col items-center gap-1">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Ajouter</span>
          </div>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
