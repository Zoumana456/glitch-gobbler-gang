import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  MailAccount,
  MailFilters,
  MailFolder,
  MailFolderKind,
  MailMessageFull,
  MailMessageSummary,
} from "@/lib/mail/types";

const FOLDERS = [
  "inbox",
  "sent",
  "drafts",
  "spam",
  "trash",
  "archive",
  "starred",
  "custom",
] as const;

const imapSchema = z.object({
  provider: z.enum(["imap", "yahoo", "gmail", "microsoft"]),
  email: z.string().email().max(200),
  displayName: z.string().max(120).nullable().optional(),
  label: z.string().max(60).nullable().optional(),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
  imapHost: z.string().min(3).max(200),
  imapPort: z.number().int().min(1).max(65535),
  imapSecurity: z.string().max(20),
  smtpHost: z.string().min(3).max(200),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecurity: z.string().max(20),
});

export const mailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ gatewayReady: boolean; accounts: MailAccount[] }> => {
    const { gatewayConfig } = await import("@/lib/mail/gateway.server");
    const { listAccountsFor } = await import("@/lib/mail/mail.server");
    return {
      gatewayReady: Boolean(gatewayConfig()),
      accounts: await listAccountsFor(context.supabase, context.userId),
    };
  });

export const testMailAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => imapSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { testImapConnection } = await import("@/lib/mail/mail.server");
    await testImapConnection(data);
    return { ok: true };
  });

export const saveMailAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => imapSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<MailAccount> => {
    const { saveImapAccountFor } = await import("@/lib/mail/mail.server");
    return saveImapAccountFor(context.userId, data);
  });

export const updateMailAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().max(60).nullable().optional(),
        displayName: z.string().max(120).nullable().optional(),
        signature: z.string().max(4000).nullable().optional(),
        signatureMode: z.enum(["auto", "manual", "none"]).optional(),
        isPrimary: z.boolean().optional(),
        status: z.enum(["connected", "disabled"]).optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const patch: Record<string, any> = {};
    if (data.label !== undefined) patch["label"] = data.label;
    if (data.displayName !== undefined) patch["display_name"] = data.displayName;
    if (data.signature !== undefined) patch["signature"] = data.signature;
    if (data.signatureMode !== undefined) patch["signature_mode"] = data.signatureMode;
    if (data.status !== undefined) patch["status"] = data.status;

    if (data.isPrimary) {
      await context.supabase
        .from("email_accounts")
        .update({ is_primary: false })
        .eq("user_id", context.userId);
      patch["is_primary"] = true;
    }
    if (Object.keys(patch).length) {
      const { error } = await context.supabase
        .from("email_accounts")
        .update(patch as never)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMailAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { deleteAccountFor } = await import("@/lib/mail/mail.server");
    await deleteAccountFor(context.userId, data.id);
    return { ok: true };
  });

export const listMailFolders = createServerFn({ method: "GET" })
  .inputValidator((d: { accountId: string }) =>
    z.object({ accountId: z.string().uuid() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<MailFolder[]> => {
    const { foldersFor } = await import("@/lib/mail/mail.server");
    return foldersFor(context.userId, data.accountId);
  });

export const listMailMessages = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid().nullable().optional(),
        folder: z.enum(FOLDERS).optional(),
        search: z.string().max(200).optional(),
        from: z.string().max(200).optional(),
        to: z.string().max(200).optional(),
        subject: z.string().max(200).optional(),
        since: z.string().max(40).optional(),
        until: z.string().max(40).optional(),
        unreadOnly: z.boolean().optional(),
        starredOnly: z.boolean().optional(),
        withAttachments: z.boolean().optional(),
        importantOnly: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      data,
      context,
    }): Promise<{ messages: MailMessageSummary[]; errors: string[] }> => {
      const { messagesFor } = await import("@/lib/mail/mail.server");
      return messagesFor(context.supabase, context.userId, data as MailFilters);
    },
  );

export const getMailMessage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ accountId: z.string().uuid(), messageId: z.string().min(1).max(400) })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<MailMessageFull> => {
    const { messageFor, flagFor } = await import("@/lib/mail/mail.server");
    const msg = await messageFor(context.userId, data.accountId, data.messageId);
    if (msg.unread) {
      try {
        await flagFor(context.userId, data.accountId, data.messageId, { read: true });
      } catch (e) {
        console.error("[mail] marquage lu impossible", e);
      }
    }
    return { ...msg, unread: false };
  });

export const flagMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        messageId: z.string().min(1).max(400),
        read: z.boolean().optional(),
        starred: z.boolean().optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { flagFor } = await import("@/lib/mail/mail.server");
    await flagFor(context.userId, data.accountId, data.messageId, {
      read: data.read,
      starred: data.starred,
    });
    return { ok: true };
  });

export const moveMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        messageId: z.string().min(1).max(400),
        folder: z.enum(FOLDERS),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { moveFor } = await import("@/lib/mail/mail.server");
    await moveFor(context.userId, data.accountId, data.messageId, data.folder as MailFolderKind);
    return { ok: true };
  });

export const deleteMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ accountId: z.string().uuid(), messageId: z.string().min(1).max(400) })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { trashFor } = await import("@/lib/mail/mail.server");
    await trashFor(context.userId, data.accountId, data.messageId);
    return { ok: true };
  });

export const downloadMailAttachment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ accountId: z.string().uuid(), attachmentId: z.string().min(1).max(400) })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ base64: string; mimeType: string }> => {
    const { attachmentFor } = await import("@/lib/mail/mail.server");
    return attachmentFor(context.userId, data.accountId, data.attachmentId);
  });

export const sendMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        to: z.array(z.string().email()).min(1).max(50),
        cc: z.array(z.string().email()).max(50).optional(),
        bcc: z.array(z.string().email()).max(50).optional(),
        subject: z.string().min(1).max(300),
        html: z.string().min(1).max(200_000),
        replyTo: z.string().max(400).nullable().optional(),
        forwardOf: z.string().max(400).nullable().optional(),
        attachments: z
          .array(
            z.object({
              filename: z.string().max(200),
              content: z.string().max(22_000_000),
              contentType: z.string().max(120),
            }),
          )
          .max(10)
          .optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { sendFor } = await import("@/lib/mail/mail.server");
    await sendFor(context.userId, data);
    return { ok: true };
  });

export const saveMailDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        accountId: z.string().uuid(),
        to: z.string().max(2000).default(""),
        cc: z.string().max(2000).default(""),
        bcc: z.string().max(2000).default(""),
        subject: z.string().max(300).default(""),
        body: z.string().max(200_000).default(""),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const payload = {
      user_id: context.userId,
      account_id: data.accountId,
      to_recipients: data.to,
      cc_recipients: data.cc,
      bcc_recipients: data.bcc,
      subject: data.subject,
      body_html: data.body,
    };
    const q = data.id
      ? context.supabase.from("email_drafts").update(payload).eq("id", data.id).select("id").single()
      : context.supabase.from("email_drafts").insert(payload).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listMailDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_drafts")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteMailDraft = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("email_drafts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncMailAccounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ accountId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ unread: number; errors: string[] }> => {
    const { syncAccountFor, syncAllFor } = await import("@/lib/mail/mail.server");
    if (data.accountId) {
      const r = await syncAccountFor(context.userId, data.accountId);
      return { unread: r.unread, errors: [] };
    }
    return syncAllFor(context.supabase, context.userId);
  });

export const listMailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_sync_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
