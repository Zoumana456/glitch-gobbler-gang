import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const key =
    request.headers.get("x-dispatch-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  // Dedicated server-only secret — the publishable key is public and must not gate this.
  const expected = process.env["MAIL_DISPATCH_SECRET"] ?? "";
  if (!expected || expected.length < 32 || key !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { dispatchDueScheduledMessages } = await import("@/lib/mail/scheduling.server");
    const result = await dispatchDueScheduledMessages();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("[mail] dispatch programmé", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/mail/dispatch-scheduled")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
});
