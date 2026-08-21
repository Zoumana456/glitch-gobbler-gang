import { decryptSecret } from "./crypto.server";
import {
  deleteGatewayMessage,
  getGatewayAttachment,
  getGatewayMessage,
  listGatewayFolders,
  listGatewayMessages,
  moveGatewayMessage,
  setGatewayFlags,
  submitGatewayMessage,
  upsertGatewayAccount,
  type GatewayQuery,
  type OutgoingMessage,
} from "./gateway.server";
import { gmailTransport } from "./gmail.server";
import { graphTransport } from "./graph.server";
import { accessTokenFor } from "./oauth.server";
import type { MailFolder, MailMessageFull, MailMessageSummary } from "./types";

export type MailTransport = {
  kind: "oauth" | "gateway";
  listFolders(): Promise<MailFolder[]>;
  listMessages(query: GatewayQuery): Promise<MailMessageSummary[]>;
  getMessage(messageId: string): Promise<MailMessageFull>;
  setFlags(messageId: string, add: string[], remove: string[]): Promise<void>;
  move(messageId: string, path: string): Promise<void>;
  remove(messageId: string): Promise<void>;
  attachment(attachmentId: string): Promise<{ base64: string; mimeType: string }>;
  submit(message: OutgoingMessage): Promise<void>;
};

function gatewayTransport(accountId: string, accountEmail: string): MailTransport {
  return {
    kind: "gateway",
    listFolders: () => listGatewayFolders(accountId),
    listMessages: (query) => listGatewayMessages(accountId, accountEmail, query),
    getMessage: (messageId) => getGatewayMessage(accountId, accountEmail, messageId),
    setFlags: (messageId, add, remove) => setGatewayFlags(accountId, messageId, add, remove),
    move: (messageId, path) => moveGatewayMessage(accountId, messageId, path),
    remove: (messageId) => deleteGatewayMessage(accountId, messageId),
    attachment: (attachmentId) => getGatewayAttachment(accountId, attachmentId),
    submit: (message) => submitGatewayMessage(accountId, message),
  };
}

/**
 * Choisit le transport adapté au compte : API officielle (OAuth Gmail /
 * Microsoft Graph) ou passerelle IMAP/SMTP pour les domaines professionnels.
 */
export async function transportForRow(row: any): Promise<MailTransport> {
  if (row.auth_type === "oauth" && row.oauth_refresh_token_ciphertext) {
    const getToken = () => accessTokenFor(row);
    return row.provider === "microsoft"
      ? { kind: "oauth", ...graphTransport(row.id, row.email, getToken) }
      : { kind: "oauth", ...gmailTransport(row.id, row.email, getToken) };
  }

  if (row.imap_password_ciphertext) {
    await upsertGatewayAccount(row.id, {
      email: row.email,
      displayName: row.display_name,
      username: row.imap_username ?? row.email,
      password: decryptSecret(row.imap_password_ciphertext),
      imapHost: row.imap_host,
      imapPort: row.imap_port,
      imapSecure: String(row.imap_security ?? "").toUpperCase().includes("SSL"),
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpSecure: !String(row.smtp_security ?? "").toUpperCase().includes("STARTTLS"),
    });
  }
  return gatewayTransport(row.id, row.email);
}
