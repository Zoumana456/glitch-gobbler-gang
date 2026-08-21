import type {
  MailAddress,
  MailAttachment,
  MailFolder,
  MailFolderKind,
  MailMessageFull,
  MailMessageSummary,
} from "./types";

/**
 * Passerelle IMAP/SMTP HTTP (API compatible EmailEngine).
 * Le runtime serveur ne peut pas ouvrir de sockets IMAP/SMTP : toutes les
 * opérations IMAP/SMTP passent par cette passerelle.
 */
export type GatewayConfig = { baseUrl: string; token: string };

export function gatewayConfig(): GatewayConfig | null {
  const baseUrl = process.env["MAIL_GATEWAY_URL"];
  const token = process.env["MAIL_GATEWAY_TOKEN"];
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

export function requireGateway(): GatewayConfig {
  const cfg = gatewayConfig();
  if (!cfg)
    throw new Error(
      "La passerelle de messagerie n'est pas encore configurée. Les comptes IMAP/SMTP seront opérationnels dès que la clé d'accès sera enregistrée.",
    );
  return cfg;
}

async function call<T>(
  method: string,
  path: string,
  init?: { body?: unknown; query?: Record<string, string | number | undefined> },
): Promise<T> {
  const cfg = requireGateway();
  const url = new URL(`${cfg.baseUrl}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[mail-gateway] ${method} ${path} -> ${res.status}: ${text}`);
    throw new Error(gatewayErrorMessage(res.status, text));
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function gatewayErrorMessage(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 401 || lower.includes("authentication") || lower.includes("invalid credentials"))
    return "Identifiants refusés par le serveur de messagerie. Vérifiez l'adresse et le mot de passe (ou le mot de passe d'application).";
  if (lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("timeout"))
    return "Impossible de joindre le serveur de messagerie. Vérifiez les paramètres de connexion.";
  if (status === 404) return "Ressource introuvable sur le serveur de messagerie.";
  return "Le serveur de messagerie a refusé l'opération. Réessayez dans un instant.";
}

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

export type ImapCredentials = {
  email: string;
  displayName?: string | null;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

function accountPayload(id: string, c: ImapCredentials) {
  return {
    account: id,
    name: c.displayName || c.email,
    email: c.email,
    imap: {
      auth: { user: c.username, pass: c.password },
      host: c.imapHost,
      port: c.imapPort,
      secure: c.imapSecure,
    },
    smtp: {
      auth: { user: c.username, pass: c.password },
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpSecure,
    },
  };
}

/** Crée/actualise le compte dans la passerelle et vérifie la connexion. */
export async function upsertGatewayAccount(
  id: string,
  c: ImapCredentials,
): Promise<void> {
  await call("POST", "/v1/account", { body: accountPayload(id, c) });
}

export async function verifyImapCredentials(c: ImapCredentials): Promise<void> {
  await call("POST", "/v1/verifyAccount", {
    body: {
      mailboxes: false,
      imap: accountPayload("verify", c).imap,
      smtp: accountPayload("verify", c).smtp,
    },
  });
}

export async function deleteGatewayAccount(id: string): Promise<void> {
  try {
    await call("DELETE", `/v1/account/${encodeURIComponent(id)}`);
  } catch (e) {
    console.error("[mail-gateway] suppression du compte impossible", e);
  }
}

/* ------------------------------------------------------------------ */
/* Dossiers et messages                                                */
/* ------------------------------------------------------------------ */

function folderKind(path: string, specialUse?: string): MailFolderKind {
  const s = (specialUse ?? "").toLowerCase();
  if (s.includes("sent")) return "sent";
  if (s.includes("draft")) return "drafts";
  if (s.includes("junk")) return "spam";
  if (s.includes("trash")) return "trash";
  if (s.includes("archive")) return "archive";
  if (s.includes("flagged")) return "starred";
  if (s.includes("inbox")) return "inbox";
  const p = path.toLowerCase();
  if (p === "inbox") return "inbox";
  if (p.includes("sent") || p.includes("envoy")) return "sent";
  if (p.includes("draft") || p.includes("brouillon")) return "drafts";
  if (p.includes("junk") || p.includes("spam")) return "spam";
  if (p.includes("trash") || p.includes("corbeille")) return "trash";
  if (p.includes("archive")) return "archive";
  return "custom";
}

export async function listGatewayFolders(accountId: string): Promise<MailFolder[]> {
  const res = await call<{ mailboxes?: any[] }>(
    "GET",
    `/v1/account/${encodeURIComponent(accountId)}/mailboxes`,
    { query: { counters: "true" } },
  );
  return (res.mailboxes ?? [])
    .filter((m) => !m.listed || m.path)
    .map((m) => ({
      id: m.path as string,
      path: m.path as string,
      name: (m.name as string) ?? m.path,
      kind: folderKind(m.path, m.specialUse),
      unread: Number(m.status?.unseen ?? 0),
    }));
}

function toAddress(a: any): MailAddress | null {
  if (!a) return null;
  return { name: a.name ?? null, address: a.address ?? "" };
}

function toAddresses(list: any): MailAddress[] {
  return Array.isArray(list)
    ? list.map(toAddress).filter((a): a is MailAddress => !!a)
    : [];
}

function mapSummary(
  m: any,
  meta: { accountId: string; accountEmail: string },
): MailMessageSummary {
  const flags: string[] = m.flags ?? [];
  return {
    id: String(m.id),
    accountId: meta.accountId,
    accountEmail: meta.accountEmail,
    provider: "imap",
    threadId: m.threadId ?? null,
    from: toAddress(m.from),
    to: toAddresses(m.to),
    subject: m.subject ?? "(sans objet)",
    snippet: (m.intro ?? m.text?.plain ?? "").toString().slice(0, 220),
    date: m.date ?? new Date().toISOString(),
    unread: m.unseen === true || !flags.includes("\\Seen"),
    starred: m.flagged === true || flags.includes("\\Flagged"),
    important: m.flagged === true || flags.includes("$Important"),
    hasAttachments: Boolean(m.attachments?.length) || m.hasAttachments === true,
  };
}

/** Recherche IMAP → paramètres de la passerelle. */
export type GatewayQuery = {
  path: string;
  page?: number;
  pageSize?: number;
  search?: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;
  unreadOnly?: boolean;
  starredOnly?: boolean;
};

export async function listGatewayMessages(
  accountId: string,
  accountEmail: string,
  q: GatewayQuery,
): Promise<MailMessageSummary[]> {
  const hasSearch =
    q.search || q.from || q.to || q.subject || q.since || q.until || q.unreadOnly || q.starredOnly;

  if (hasSearch) {
    const res = await call<{ messages?: any[] }>(
      "POST",
      `/v1/account/${encodeURIComponent(accountId)}/search`,
      {
        query: { path: q.path, page: q.page ?? 0, pageSize: q.pageSize ?? 40 },
        body: {
          search: {
            ...(q.search ? { body: q.search } : {}),
            ...(q.from ? { from: q.from } : {}),
            ...(q.to ? { to: q.to } : {}),
            ...(q.subject ? { subject: q.subject } : {}),
            ...(q.since ? { since: q.since } : {}),
            ...(q.until ? { before: q.until } : {}),
            ...(q.unreadOnly ? { unseen: true } : {}),
            ...(q.starredOnly ? { flagged: true } : {}),
          },
        },
      },
    );
    return (res.messages ?? []).map((m) => mapSummary(m, { accountId, accountEmail }));
  }

  const res = await call<{ messages?: any[] }>(
    "GET",
    `/v1/account/${encodeURIComponent(accountId)}/messages`,
    { query: { path: q.path, page: q.page ?? 0, pageSize: q.pageSize ?? 40 } },
  );
  return (res.messages ?? []).map((m) => mapSummary(m, { accountId, accountEmail }));
}

export async function getGatewayMessage(
  accountId: string,
  accountEmail: string,
  messageId: string,
): Promise<MailMessageFull> {
  const m = await call<any>(
    "GET",
    `/v1/account/${encodeURIComponent(accountId)}/message/${encodeURIComponent(messageId)}`,
    { query: { textType: "*", webSafeHtml: "true" } },
  );
  const attachments: MailAttachment[] = (m.attachments ?? []).map((a: any) => ({
    id: String(a.id),
    filename: a.filename ?? "piece-jointe",
    mimeType: a.contentType ?? "application/octet-stream",
    size: Number(a.encodedSize ?? a.size ?? 0),
  }));
  return {
    ...mapSummary(m, { accountId, accountEmail }),
    cc: toAddresses(m.cc),
    bcc: toAddresses(m.bcc),
    html: m.text?.html ?? null,
    text: m.text?.plain ?? null,
    attachments,
  };
}

export async function setGatewayFlags(
  accountId: string,
  messageId: string,
  add: string[],
  remove: string[],
): Promise<void> {
  await call("PUT", `/v1/account/${encodeURIComponent(accountId)}/message/${encodeURIComponent(messageId)}`, {
    body: { flags: { add, delete: remove } },
  });
}

export async function moveGatewayMessage(
  accountId: string,
  messageId: string,
  path: string,
): Promise<void> {
  await call("PUT", `/v1/account/${encodeURIComponent(accountId)}/message/${encodeURIComponent(messageId)}/move`, {
    body: { path },
  });
}

export async function deleteGatewayMessage(
  accountId: string,
  messageId: string,
): Promise<void> {
  await call("DELETE", `/v1/account/${encodeURIComponent(accountId)}/message/${encodeURIComponent(messageId)}`);
}

export async function getGatewayAttachment(
  accountId: string,
  attachmentId: string,
): Promise<{ base64: string; mimeType: string }> {
  const cfg = requireGateway();
  const res = await fetch(
    `${cfg.baseUrl}/v1/account/${encodeURIComponent(accountId)}/attachment/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${cfg.token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`[mail-gateway] attachment ${res.status}: ${body}`);
    throw new Error(gatewayErrorMessage(res.status, body));
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    base64: buf.toString("base64"),
    mimeType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

export type OutgoingMessage = {
  from: { name?: string | null; address: string };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  reference?: { message: string; action: "reply" | "forward" } | null;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export async function submitGatewayMessage(
  accountId: string,
  msg: OutgoingMessage,
): Promise<void> {
  await call("POST", `/v1/account/${encodeURIComponent(accountId)}/submit`, {
    body: {
      from: { name: msg.from.name ?? undefined, address: msg.from.address },
      to: msg.to.map((address) => ({ address })),
      cc: (msg.cc ?? []).map((address) => ({ address })),
      bcc: (msg.bcc ?? []).map((address) => ({ address })),
      subject: msg.subject,
      html: msg.html,
      ...(msg.reference ? { reference: msg.reference } : {}),
      ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
    },
  });
}
