import type {
  MailAddress,
  MailAttachment,
  MailFolder,
  MailFolderKind,
  MailMessageFull,
  MailMessageSummary,
} from "./types";
import type { GatewayQuery, OutgoingMessage } from "./gateway.server";

const API = "https://graph.microsoft.com/v1.0";

const FOLDER_BY_KIND: Partial<Record<MailFolderKind, string>> = {
  inbox: "inbox",
  sent: "sentitems",
  drafts: "drafts",
  spam: "junkemail",
  trash: "deleteditems",
  archive: "archive",
};

const KIND_BY_WELLKNOWN: Record<string, MailFolderKind> = {
  inbox: "inbox",
  sentitems: "sent",
  drafts: "drafts",
  junkemail: "spam",
  deleteditems: "trash",
  archive: "archive",
};

async function api<T>(
  token: string,
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {}))
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[graph] ${init?.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
    if (res.status === 401 || res.status === 403)
      throw new Error(
        "Accès Outlook refusé. Reconnectez le compte depuis les paramètres de messagerie.",
      );
    throw new Error("Outlook a refusé l'opération. Réessayez dans un instant.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function addr(a: any): MailAddress | null {
  const e = a?.emailAddress;
  if (!e?.address) return null;
  return { name: e.name ?? null, address: e.address };
}

function addrList(list: any): MailAddress[] {
  return Array.isArray(list)
    ? list.map(addr).filter((a): a is MailAddress => !!a)
    : [];
}

function summarize(m: any, accountId: string, accountEmail: string): MailMessageSummary {
  return {
    id: String(m.id),
    accountId,
    accountEmail,
    provider: "microsoft",
    threadId: m.conversationId ?? null,
    from: addr(m.from ?? m.sender),
    to: addrList(m.toRecipients),
    subject: m.subject || "(sans objet)",
    snippet: String(m.bodyPreview ?? "").slice(0, 220),
    date: m.receivedDateTime ?? m.sentDateTime ?? new Date().toISOString(),
    unread: m.isRead === false,
    starred: m.flag?.flagStatus === "flagged",
    important: m.importance === "high",
    hasAttachments: m.hasAttachments === true,
  };
}

const SELECT =
  "id,conversationId,subject,bodyPreview,receivedDateTime,sentDateTime,isRead,flag,importance,hasAttachments,from,sender,toRecipients";

function filterFor(q: GatewayQuery): string | undefined {
  const parts: string[] = [];
  if (q.unreadOnly) parts.push("isRead eq false");
  if (q.starredOnly) parts.push("flag/flagStatus eq 'flagged'");
  if (q.since) parts.push(`receivedDateTime ge ${new Date(q.since).toISOString()}`);
  if (q.until) parts.push(`receivedDateTime le ${new Date(q.until).toISOString()}`);
  if (q.from) parts.push(`from/emailAddress/address eq '${q.from.replace(/'/g, "''")}'`);
  return parts.length ? parts.join(" and ") : undefined;
}

export function graphTransport(
  accountId: string,
  accountEmail: string,
  getToken: () => Promise<string>,
) {
  return {
    async listFolders(): Promise<MailFolder[]> {
      const token = await getToken();
      const res = await api<{ value?: any[] }>(token, "/me/mailFolders", {
        query: { $top: 60 },
      });
      return (res.value ?? []).map((f) => {
        const wk = String(f.wellKnownName ?? "").toLowerCase();
        return {
          id: String(f.id),
          path: wk && KIND_BY_WELLKNOWN[wk] ? wk : String(f.id),
          name: String(f.displayName ?? wk),
          kind: KIND_BY_WELLKNOWN[wk] ?? "custom",
          unread: Number(f.unreadItemCount ?? 0),
        };
      });
    },

    async listMessages(q: GatewayQuery): Promise<MailMessageSummary[]> {
      const token = await getToken();
      const kind = (Object.keys(FOLDER_BY_KIND) as MailFolderKind[]).find(
        (k) => FOLDER_BY_KIND[k] === q.path,
      );
      const folder = kind ? FOLDER_BY_KIND[kind] : q.path;
      const search = q.search || q.subject || q.to;
      const res = await api<{ value?: any[] }>(
        token,
        `/me/mailFolders/${encodeURIComponent(folder ?? "inbox")}/messages`,
        {
          query: {
            $top: q.pageSize ?? 30,
            $select: SELECT,
            ...(search
              ? { $search: `"${String(search).replace(/"/g, "")}"` }
              : {
                  $orderby: "receivedDateTime desc",
                  ...(filterFor(q) ? { $filter: filterFor(q) } : {}),
                }),
          },
          headers: search ? { ConsistencyLevel: "eventual" } : {},
        },
      );
      return (res.value ?? []).map((m) => summarize(m, accountId, accountEmail));
    },

    async getMessage(messageId: string): Promise<MailMessageFull> {
      const token = await getToken();
      const m = await api<any>(token, `/me/messages/${encodeURIComponent(messageId)}`);
      let attachments: MailAttachment[] = [];
      if (m.hasAttachments) {
        try {
          const res = await api<{ value?: any[] }>(
            token,
            `/me/messages/${encodeURIComponent(messageId)}/attachments`,
            { query: { $select: "id,name,contentType,size" } },
          );
          attachments = (res.value ?? []).map((a) => ({
            id: `${messageId}:${a.id}`,
            filename: a.name ?? "piece-jointe",
            mimeType: a.contentType ?? "application/octet-stream",
            size: Number(a.size ?? 0),
          }));
        } catch (e) {
          console.error("[graph] pièces jointes illisibles", e);
        }
      }
      const isHtml = String(m.body?.contentType ?? "").toLowerCase() === "html";
      return {
        ...summarize(m, accountId, accountEmail),
        cc: addrList(m.ccRecipients),
        bcc: addrList(m.bccRecipients),
        html: isHtml ? (m.body?.content ?? null) : null,
        text: isHtml ? null : (m.body?.content ?? null),
        attachments,
      };
    },

    async setFlags(messageId: string, add: string[], remove: string[]): Promise<void> {
      const token = await getToken();
      const patch: Record<string, unknown> = {};
      if (add.includes("\\Seen")) patch["isRead"] = true;
      if (remove.includes("\\Seen")) patch["isRead"] = false;
      if (add.includes("\\Flagged")) patch["flag"] = { flagStatus: "flagged" };
      if (remove.includes("\\Flagged")) patch["flag"] = { flagStatus: "notFlagged" };
      if (!Object.keys(patch).length) return;
      await api(token, `/me/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        body: patch,
      });
    },

    async move(messageId: string, path: string): Promise<void> {
      const token = await getToken();
      await api(token, `/me/messages/${encodeURIComponent(messageId)}/move`, {
        method: "POST",
        body: { destinationId: path },
      });
    },

    async remove(messageId: string): Promise<void> {
      const token = await getToken();
      await api(token, `/me/messages/${encodeURIComponent(messageId)}/move`, {
        method: "POST",
        body: { destinationId: "deleteditems" },
      });
    },

    async attachment(id: string): Promise<{ base64: string; mimeType: string }> {
      const token = await getToken();
      const [messageId, attachmentId] = id.split(":");
      if (!messageId || !attachmentId) throw new Error("Pièce jointe introuvable.");
      const a = await api<any>(
        token,
        `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      );
      return {
        base64: String(a.contentBytes ?? ""),
        mimeType: a.contentType ?? "application/octet-stream",
      };
    },

    async submit(msg: OutgoingMessage): Promise<void> {
      const token = await getToken();
      await api(token, "/me/sendMail", {
        method: "POST",
        body: {
          message: {
            subject: msg.subject,
            body: { contentType: "HTML", content: msg.html },
            toRecipients: msg.to.map((address) => ({ emailAddress: { address } })),
            ccRecipients: (msg.cc ?? []).map((address) => ({ emailAddress: { address } })),
            bccRecipients: (msg.bcc ?? []).map((address) => ({ emailAddress: { address } })),
            ...(msg.attachments?.length
              ? {
                  attachments: msg.attachments.map((a) => ({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: a.filename,
                    contentType: a.contentType,
                    contentBytes: a.content,
                  })),
                }
              : {}),
          },
          saveToSentItems: true,
        },
      });
    },
  };
}
