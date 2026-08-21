/** Types partagés du module Messagerie (client-safe : aucun secret ici). */

export type MailProvider = "gmail" | "microsoft" | "yahoo" | "imap";

export type MailAccountStatus =
  | "connected"
  | "disabled"
  | "error"
  | "reauth_required";

export type MailAccount = {
  id: string;
  provider: MailProvider;
  email: string;
  display_name: string | null;
  label: string | null;
  status: MailAccountStatus;
  status_message: string | null;
  is_primary: boolean;
  signature: string | null;
  signature_mode: "auto" | "manual" | "none";
  imap_host: string | null;
  imap_port: number | null;
  imap_security: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  imap_username: string | null;
  unread_count: number;
  last_sync_at: string | null;
};

export type MailFolderKind =
  | "inbox"
  | "sent"
  | "drafts"
  | "spam"
  | "trash"
  | "archive"
  | "starred"
  | "custom";

export type MailFolder = {
  id: string;
  kind: MailFolderKind;
  name: string;
  path: string;
  unread: number;
};

export type MailAddress = { name: string | null; address: string };

export type MailMessageSummary = {
  id: string;
  accountId: string;
  accountEmail: string;
  provider: MailProvider;
  threadId: string | null;
  from: MailAddress | null;
  to: MailAddress[];
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  hasAttachments: boolean;
};

export type MailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type MailMessageFull = MailMessageSummary & {
  cc: MailAddress[];
  bcc: MailAddress[];
  html: string | null;
  text: string | null;
  attachments: MailAttachment[];
};

export type MailFilters = {
  accountId?: string | null;
  folder?: MailFolderKind;
  search?: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  withAttachments?: boolean;
  importantOnly?: boolean;
};

export const PROVIDER_LABELS: Record<MailProvider, string> = {
  gmail: "Gmail / Google Workspace",
  microsoft: "Outlook / Microsoft 365",
  yahoo: "Yahoo Mail",
  imap: "Compte professionnel (IMAP/SMTP)",
};

export const FOLDER_LABELS: Record<MailFolderKind, string> = {
  inbox: "Boîte de réception",
  sent: "Messages envoyés",
  drafts: "Brouillons",
  spam: "Spam",
  trash: "Corbeille",
  archive: "Archives",
  starred: "Favoris",
  custom: "Autre dossier",
};

export const FOLDER_ORDER: MailFolderKind[] = [
  "inbox",
  "sent",
  "drafts",
  "spam",
  "trash",
  "archive",
  "starred",
];

/** Préréglages serveurs pour les fournisseurs courants. */
export const IMAP_PRESETS: Record<
  string,
  {
    label: string;
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    security: string;
    smtp_security: string;
    hint?: string;
  }
> = {
  yahoo: {
    label: "Yahoo Mail",
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: 465,
    security: "SSL/TLS",
    smtp_security: "SSL/TLS",
    hint: "Yahoo exige un mot de passe d'application (Compte → Sécurité → Générer un mot de passe d'application).",
  },
  gmail: {
    label: "Gmail",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    security: "SSL/TLS",
    smtp_security: "SSL/TLS",
    hint: "Gmail exige un mot de passe d'application (validation en deux étapes activée).",
  },
  microsoft: {
    label: "Outlook / Hotmail",
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
    security: "SSL/TLS",
    smtp_security: "STARTTLS",
  },
};

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/zip",
  "text/plain",
  "text/csv",
];

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} Ko`;
  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
}

export function addressLabel(a: MailAddress | null | undefined): string {
  if (!a) return "(inconnu)";
  return a.name?.trim() ? a.name : a.address;
}
