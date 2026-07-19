import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, X, FileText, FileVideo, File as FileIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { validateUpload, buildSafeStoragePath } from "@/lib/upload-validation";

export type FormAttachment = {
  key: string;
  storage_path: string;
  url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploading?: boolean;
};

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const ATTACHMENT_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/webm",
  "video/quicktime",
].join(",");

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function iconFor(mime: string) {
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("pdf") || mime.includes("word")) return FileText;
  return FileIcon;
}

export async function uploadAttachment(
  file: File,
): Promise<{ storage_path: string; url: string } | null> {
  const check = await validateUpload(file, "report-attachments");
  if (!check.ok) {
    toast.error(check.reason);
    return null;
  }
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "anon";
  const path = buildSafeStoragePath(uid, check.sanitizedExt);
  const { error } = await supabase.storage
    .from("report-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    toast.error("Envoi impossible : " + error.message);
    return null;
  }
  const { data: signed } = await supabase.storage
    .from("report-attachments")
    .createSignedUrl(path, 5 * 60); // 5 min
  return { storage_path: path, url: signed?.signedUrl ?? "" };
}


export function AttachmentsList({
  attachments,
  onAdd,
  onRemove,
  label = "Pièces jointes",
}: {
  attachments: FormAttachment[];
  onAdd: (files: FileList) => void;
  onRemove: (key: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4 mr-1.5" />
          Ajouter (PDF, Word, vidéo · 5 Mo max)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((att) => {
            const Icon = iconFor(att.mime_type);
            return (
              <li
                key={att.key}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{att.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {humanSize(att.size_bytes)}
                  </div>
                </div>
                {att.uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(att.key)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AttachmentsView({
  attachments,
  title = "Pièces jointes",
}: {
  attachments: Array<{
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    url: string;
  }>;
  title?: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <ul className="space-y-2">
        {attachments.map((att) => {
          const Icon = iconFor(att.mime_type);
          const isVideo = att.mime_type.startsWith("video/");
          return (
            <li
              key={att.id}
              className="rounded-md border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{att.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {humanSize(att.size_bytes)}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={att.url} target="_blank" rel="noreferrer" download={att.file_name}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Ouvrir
                  </a>
                </Button>
              </div>
              {isVideo && att.url && (
                <video
                  src={att.url}
                  controls
                  className="mt-3 w-full max-h-[400px] rounded"
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
