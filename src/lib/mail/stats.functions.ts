import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MailStats = {
  accounts: {
    id: string;
    email: string;
    label: string | null;
    provider: string;
    status: string;
    status_message: string | null;
    unread_count: number;
    last_sync_at: string | null;
    is_primary: boolean;
  }[];
  unreadTotal: number;
  sent7: number;
  sent30: number;
  sendFailures30: number;
  successRate: number;
  attachmentsSent30: number;
  syncErrors7: number;
  scheduledPending: number;
  scheduledFailed: number;
  scheduledSent30: number;
  templates: number;
  signatures: number;
  sentByDay: { day: string; sent: number; failed: number }[];
  unreadByAccount: { name: string; unread: number }[];
  recent: {
    id: string;
    action: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }[];
};

const DAY = 86_400_000;

export const mailDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailStats> => {
    const { supabase, userId } = context;
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const since14 = new Date(now - 13 * DAY).toISOString();
    const since7 = new Date(now - 7 * DAY).toISOString();

    const [accountsRes, logsRes, scheduledRes, templatesRes, signaturesRes, recentRes] =
      await Promise.all([
        supabase
          .from("email_accounts")
          .select(
            "id, email, label, provider, status, status_message, unread_count, last_sync_at, is_primary",
          )
          .eq("user_id", userId)
          .order("is_primary", { ascending: false }),
        supabase
          .from("email_sync_logs")
          .select("action, status, created_at")
          .eq("user_id", userId)
          .gte("created_at", since30),
        supabase
          .from("email_scheduled_messages")
          .select("status, scheduled_at, sent_at, attachments")
          .eq("user_id", userId),
        supabase.from("email_templates").select("id", { count: "exact", head: true }),
        supabase
          .from("email_signatures")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("email_sync_logs")
          .select("id, action, status, error_message, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

    if (accountsRes.error) throw new Error(accountsRes.error.message);

    const accounts = (accountsRes.data ?? []) as unknown as MailStats["accounts"];
    const logs = (logsRes.data ?? []) as { action: string; status: string; created_at: string }[];
    const scheduled = (scheduledRes.data ?? []) as {
      status: string;
      scheduled_at: string;
      sent_at: string | null;
      attachments: unknown[] | null;
    }[];

    const isSend = (a: string) => a.startsWith("message.send") || a.startsWith("message.scheduled");
    const sendLogs = logs.filter((l) => isSend(l.action));
    const sent30 = sendLogs.filter((l) => l.status === "success").length;
    const sent7 = sendLogs.filter(
      (l) => l.status === "success" && l.created_at >= since7,
    ).length;
    const sendFailures30 = sendLogs.filter((l) => l.status === "error").length;
    const total30 = sent30 + sendFailures30;

    const days: { day: string; sent: number; failed: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now - i * DAY);
      days.push({ day: d.toISOString().slice(0, 10), sent: 0, failed: 0 });
    }
    for (const l of sendLogs) {
      if (l.created_at < since14) continue;
      const key = l.created_at.slice(0, 10);
      const bucket = days.find((d) => d.day === key);
      if (!bucket) continue;
      if (l.status === "success") bucket.sent += 1;
      else bucket.failed += 1;
    }

    const scheduledSent = scheduled.filter((s) => s.status === "sent");

    return {
      accounts,
      unreadTotal: accounts.reduce((s, a) => s + (a.unread_count ?? 0), 0),
      sent7,
      sent30,
      sendFailures30,
      successRate: total30 === 0 ? 100 : Math.round((sent30 / total30) * 100),
      attachmentsSent30: scheduledSent.reduce(
        (s, r) => s + (Array.isArray(r.attachments) ? r.attachments.length : 0),
        0,
      ),
      syncErrors7: logs.filter(
        (l) => l.status === "error" && !isSend(l.action) && l.created_at >= since7,
      ).length,
      scheduledPending: scheduled.filter((s) => s.status === "pending").length,
      scheduledFailed: scheduled.filter((s) => s.status === "failed").length,
      scheduledSent30: scheduledSent.filter((s) => (s.sent_at ?? "") >= since30).length,
      templates: templatesRes.count ?? 0,
      signatures: signaturesRes.count ?? 0,
      sentByDay: days,
      unreadByAccount: accounts.map((a) => ({
        name: a.label || a.email,
        unread: a.unread_count ?? 0,
      })),
      recent: (recentRes.data ?? []) as unknown as MailStats["recent"],
    };
  });
