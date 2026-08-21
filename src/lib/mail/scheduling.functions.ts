import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ScheduledMailRow = {
  id: string;
  account_id: string;
  to_recipients: string;
  cc_recipients: string;
  bcc_recipients: string;
  subject: string;
  body_html: string;
  attachments: { filename: string; contentType: string; size: number }[];
  scheduled_at: string;
  status: "pending" | "sending" | "sent" | "failed" | "canceled";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

const attachmentSchema = z.object({
  filename: z.string().max(200),
  contentType: z.string().max(120),
  content: z.string().max(22_000_000),
  size: z.number().int().nonnegative(),
});

export const scheduleMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        to: z.string().min(3).max(2000),
        cc: z.string().max(2000).default(""),
        bcc: z.string().max(2000).default(""),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(200_000),
        scheduledAt: z.string().min(10).max(40),
        replyTo: z.string().max(400).nullable().optional(),
        attachments: z.array(attachmentSchema).max(10).optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Date d'envoi invalide.");
    if (when.getTime() < Date.now() - 60_000)
      throw new Error("La date d'envoi doit être dans le futur.");

    const { data: row, error } = await context.supabase
      .from("email_scheduled_messages")
      .insert({
        user_id: context.userId,
        account_id: data.accountId,
        to_recipients: data.to,
        cc_recipients: data.cc,
        bcc_recipients: data.bcc,
        subject: data.subject,
        body_html: data.body,
        in_reply_to: data.replyTo ?? null,
        attachments: (data.attachments ?? []) as never,
        scheduled_at: when.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const listScheduledMails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScheduledMailRow[]> => {
    const { data, error } = await context.supabase
      .from("email_scheduled_messages")
      .select(
        "id, account_id, to_recipients, cc_recipients, bcc_recipients, subject, body_html, attachments, scheduled_at, status, attempts, last_error, sent_at, created_at",
      )
      .eq("user_id", context.userId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScheduledMailRow[];
  });

export const rescheduleMailMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), scheduledAt: z.string().min(10).max(40) })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Date d'envoi invalide.");
    const { error } = await context.supabase
      .from("email_scheduled_messages")
      .update({
        scheduled_at: when.toISOString(),
        status: "pending",
        last_error: null,
        attempts: 0,
      } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["pending", "failed", "canceled"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelScheduledMail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("email_scheduled_messages")
      .update({ status: "canceled" } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScheduledMail = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("email_scheduled_messages")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendScheduledMailNow = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { dispatchScheduledMessage } = await import("@/lib/mail/scheduling.server");
    const { data: row, error } = await context.supabase
      .from("email_scheduled_messages")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    await dispatchScheduledMessage(row as never);
    return { ok: true };
  });
