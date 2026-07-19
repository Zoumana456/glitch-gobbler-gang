import { fileTypeFromBlob } from "file-type";

/**
 * Whitelist des types autorisés par catégorie de bucket.
 * Basée sur les magic numbers réels, pas sur le MIME déclaré par le navigateur.
 */
export const UPLOAD_RULES = {
  "report-images": {
    maxBytes: 5 * 1024 * 1024, // 5 Mo
    allowedExt: ["png", "jpg", "jpeg", "webp", "gif"] as const,
    // MIME acceptés (peuvent différer du sniff : gif => "image/gif")
    allowedMime: ["image/png", "image/jpeg", "image/webp", "image/gif"] as const,
    label: "image (PNG, JPG, WEBP, GIF)",
  },
  "report-attachments": {
    maxBytes: 5 * 1024 * 1024, // 5 Mo
    allowedExt: ["pdf", "doc", "docx", "mp4", "webm", "mov"] as const,
    allowedMime: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/x-cfb", // .doc ancien détecté ainsi
      "application/zip", // .docx détecté ainsi (OOXML = zip)
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ] as const,
    label: "document PDF/Word ou vidéo MP4/WEBM/MOV",
  },
  "company-proofs": {
    maxBytes: 10 * 1024 * 1024, // 10 Mo
    allowedExt: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"] as const,
    allowedMime: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/x-cfb",
      "application/zip",
    ] as const,
    label: "justificatif PDF, image ou Word",
  },
} as const;

export type UploadBucket = keyof typeof UPLOAD_RULES;

/** Formats explicitement bloqués (au-delà de la whitelist), pour message clair. */
const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "sh", "ps1", "com", "scr", "vbs", "jar",
  "js", "mjs", "html", "htm", "xhtml", "svg", "phtml", "php", "py", "rb",
  "zip", "rar", "7z", "tar", "gz", // archives (sauf docx qui est un zip, géré via magic)
  "apk", "ipa", "dmg", "iso",
]);

export type UploadValidationResult =
  | { ok: true; sanitizedExt: string; sniffedMime: string }
  | { ok: false; reason: string };

/**
 * Valide un fichier avant upload : taille + extension + magic number.
 * À appeler côté client ET (idéalement) répliquer côté serveur.
 */
export async function validateUpload(
  file: File,
  bucket: UploadBucket,
): Promise<UploadValidationResult> {
  const rule = UPLOAD_RULES[bucket];
  if (file.size === 0) return { ok: false, reason: "Fichier vide" };
  if (file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return { ok: false, reason: `Fichier trop volumineux (max ${maxMb} Mo)` };
  }

  const nameExt = (file.name.split(".").pop() ?? "").toLowerCase();
  if (BLOCKED_EXT.has(nameExt)) {
    return { ok: false, reason: `Type ".${nameExt}" refusé pour raisons de sécurité` };
  }

  // Sniff magic numbers (lit les premiers octets seulement)
  let sniffed: { ext: string; mime: string } | undefined;
  try {
    sniffed = await fileTypeFromBlob(file);
  } catch {
    sniffed = undefined;
  }

  // Cas .doc / .docx / vidéos parfois mal sniffés — on tolère si l'ext ET le MIME
  // déclaré sont dans la whitelist et que rien de suspect n'est détecté.
  const declaredMime = file.type;
  const extOk = (rule.allowedExt as readonly string[]).includes(nameExt);
  const declaredMimeOk = (rule.allowedMime as readonly string[]).includes(declaredMime);

  if (sniffed) {
    const sniffedOk =
      (rule.allowedMime as readonly string[]).includes(sniffed.mime) ||
      (rule.allowedExt as readonly string[]).includes(sniffed.ext);
    if (!sniffedOk) {
      return {
        ok: false,
        reason: `Contenu détecté (${sniffed.mime}) non autorisé — attendu : ${rule.label}`,
      };
    }
    return { ok: true, sanitizedExt: sniffed.ext, sniffedMime: sniffed.mime };
  }

  // Pas de sniff possible : on retombe sur extension + MIME déclaré, tous deux requis.
  if (!extOk || !declaredMimeOk) {
    return {
      ok: false,
      reason: `Format non reconnu — attendu : ${rule.label}`,
    };
  }
  return { ok: true, sanitizedExt: nameExt, sniffedMime: declaredMime };
}

/** Génère un chemin de stockage propre : {uid}/{uuid}.{ext} — ignore le nom client. */
export function buildSafeStoragePath(uid: string, ext: string): string {
  const clean = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "bin";
  return `${uid}/${crypto.randomUUID()}.${clean}`;
}
