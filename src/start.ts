import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Ajoute les en-têtes de sécurité HTTP standard sur toutes les réponses.
 * On volontairement N'ajoute PAS X-Frame-Options: DENY ni CSP frame-ancestors 'none'
 * pour rester compatible avec la preview Lovable qui charge l'app en iframe.
 */
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  const res = response as unknown as { headers?: Headers };
  if (!res.headers || typeof res.headers.set !== "function") return response;
  const h = res.headers;
  // Empêche le sniff MIME côté navigateur
  if (!h.has("x-content-type-options")) h.set("X-Content-Type-Options", "nosniff");
  // Ne divulgue pas l'URL complète en cross-origin
  if (!h.has("referrer-policy")) h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Réduit la surface d'attaque API navigateur
  if (!h.has("permissions-policy")) {
    h.set(
      "Permissions-Policy",
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
  }
  // HSTS en production uniquement (dev = http://localhost)
  if (!h.has("strict-transport-security") && process.env.NODE_ENV === "production") {
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // Protection XSS legacy pour vieux navigateurs
  if (!h.has("x-xss-protection")) h.set("X-XSS-Protection", "1; mode=block");
  return response;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
