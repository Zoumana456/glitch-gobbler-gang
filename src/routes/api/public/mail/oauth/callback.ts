import { createFileRoute } from "@tanstack/react-router";

function back(origin: string, params: Record<string, string>): Response {
  const url = new URL("/mail/settings", origin || "http://localhost:8080");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/public/mail/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error");
        const fallbackOrigin = url.origin;

        const {
          verifyState,
          exchangeCode,
          fetchIdentity,
          saveOAuthAccount,
        } = await import("@/lib/mail/oauth.server");

        let origin = fallbackOrigin;
        try {
          if (!state) throw new Error("Requête de connexion invalide.");
          const verified = verifyState(state);
          origin = verified.origin || fallbackOrigin;
          if (providerError) throw new Error("Connexion refusée par le fournisseur.");
          if (!code) throw new Error("Code d'autorisation manquant.");

          const tokens = await exchangeCode(verified.provider, code, origin);
          const identity = await fetchIdentity(verified.provider, tokens.access_token);
          const accountId = await saveOAuthAccount(
            verified.userId,
            verified.provider,
            tokens,
            identity,
          );

          try {
            const { syncAccountFor } = await import("@/lib/mail/mail.server");
            await syncAccountFor(verified.userId, accountId);
          } catch (e) {
            console.error("[mail-oauth] première synchronisation impossible", e);
          }

          return back(origin, { connected: identity.email });
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "La connexion du compte a échoué.";
          console.error("[mail-oauth] échec du rappel", e);
          return back(origin, { mail_error: message });
        }
      },
    },
  },
});
