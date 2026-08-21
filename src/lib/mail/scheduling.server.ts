import type { SupabaseClient } from "@supabase/supabase-js";
import { logMailEvent, sendFor } from "./mail.server";

export type ScheduledRow = {
  id: string;
  user_id: string;
  account_id: string;
  to_recipients: string;
  cc_recipients: string;
  bcc_recipients: string;
  subject: string;
  body_html: string;
  in_reply_to: string | null;
  attachments: { filename: string; contentType: string; content: string }[] | null;
  scheduled_at: string;
  status: string;
  attempts: number;
};

const MAX_ATTEMPTS = 3;

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

async function admin(): Promise<SupabaseClient<any>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<any>;
}

/** Envoie un message programmé et met à jour son état. */
export async function dispatchScheduledMessage(row: ScheduledRow): Promise<boolean> {
  const db = await admin();
  await db
    .from("email_scheduled_messages")
    .update({ status: "sending", attempts: (row.attempts ?? 0) + 1 })
    .eq("id", row.id);

  try {
    await sendFor(row.user_id, {
      accountId: row.account_id,
      to: splitAddresses(row.to_recipients),
      cc: splitAddresses(row.cc_recipients ?? ""),
      bcc: splitAddresses(row.bcc_recipients ?? ""),
      subject: row.subject,
      html: row.body_html,
      replyTo: row.in_reply_to,
      attachments: (row.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    await db
      .from("email_scheduled_messages")
      .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id);
    await logMailEvent(row.user_id, row.account_id, "message.scheduled.sent", "success");
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Envoi programmé impossible.";
    const attempts = (row.attempts ?? 0) + 1;
    await db
      .from("email_scheduled_messages")
      .update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        last_error: message.slice(0, 500),
      })
      .eq("id", row.id);
    await logMailEvent(
      row.user_id,
      row.account_id,
      "message.scheduled.error",
      "error",
      message,
    );
    return false;
  }
}

/** Traite tous les envois programmés arrivés à échéance. */
export async function dispatchDueScheduledMessages(
  limit = 25,
): Promise<{ processed: number; sent: number; failed: number }> {
  const db = await admin();
  const { data, error } = await db
    .from("email_scheduled_messages")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ScheduledRow[];
  let sent = 0;
  for (const row of rows) {
    const ok = await dispatchScheduledMessage(row);
    if (ok) sent += 1;
  }
  return { processed: rows.length, sent, failed: rows.length - sent };
}
