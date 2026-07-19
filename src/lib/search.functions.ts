import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SearchResult = {
  kind: "report" | "minute" | "member" | "company";
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

/**
 * Recherche unifiée sur rapports / PV / employés / entreprises.
 * Renvoie top-5 par catégorie, RLS-scoped (l'utilisateur ne voit que ses accès).
 */
export const globalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) =>
    z.object({ query: z.string().trim().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult[]> => {
    const { supabase } = context;
    const q = data.query;
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const results: SearchResult[] = [];

    const [reports, minutes, members, companies] = await Promise.all([
      supabase
        .from("reports")
        .select("id, title, report_date")
        .ilike("title", like)
        .order("report_date", { ascending: false })
        .limit(5),
      supabase
        .from("report_minutes")
        .select("id, subject, held_at")
        .ilike("subject", like)
        .order("held_at", { ascending: false })
        .limit(5),
      supabase
        .from("company_members")
        .select("user_id, profiles:profiles!inner(id, full_name, email)")
        .or(
          `profiles.full_name.ilike.${like},profiles.email.ilike.${like}`,
        )
        .limit(5),
      supabase
        .from("companies")
        .select("id, name, slug")
        .ilike("name", like)
        .limit(5),
    ]);

    (reports.data ?? []).forEach((r: any) =>
      results.push({
        kind: "report",
        id: r.id,
        title: r.title,
        subtitle: r.report_date,
        href: `/reports/${r.id}`,
      }),
    );
    (minutes.data ?? []).forEach((m: any) =>
      results.push({
        kind: "minute",
        id: m.id,
        title: m.subject,
        subtitle: m.held_at?.slice(0, 10) ?? null,
        href: `/minutes/${m.id}`,
      }),
    );
    (members.data ?? []).forEach((m: any) =>
      results.push({
        kind: "member",
        id: m.user_id,
        title: m.profiles?.full_name ?? m.profiles?.email ?? "Employé",
        subtitle: m.profiles?.email ?? null,
        href: `/company/employees/${m.user_id}`,
      }),
    );
    (companies.data ?? []).forEach((c: any) =>
      results.push({
        kind: "company",
        id: c.id,
        title: c.name,
        subtitle: `/${c.slug}`,
        href: `/company`,
      }),
    );

    return results;
  });
