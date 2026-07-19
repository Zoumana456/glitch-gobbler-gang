import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI, DEFAULT_MODEL } from "./ai-gateway.server";

export type MinuteAttendee = { name: string; role: string };

export type ReportMinute = {
  id: string;
  report_id: string;
  author_id: string;
  number: string;
  held_at: string;
  location: string;
  subject: string;
  attendees: MinuteAttendee[];
  facts: string;
  decisions: string;
  signer_name: string;
  signer_role: string;
  signature_url: string | null;
  created_at: string;
  updated_at: string;
};

const attendeeSchema = z.object({
  name: z.string().max(160).default(""),
  role: z.string().max(160).default(""),
});

const baseFields = {
  number: z.string().max(80).default(""),
  held_at: z.string().min(1),
  location: z.string().max(240).default(""),
  subject: z.string().max(240).default(""),
  attendees: z.array(attendeeSchema).max(100).default([]),
  facts: z.string().max(20000).default(""),
  decisions: z.string().max(20000).default(""),
  signer_name: z.string().max(160).default(""),
  signer_role: z.string().max(160).default(""),
};

const createSchema = z.object({
  reportId: z.string().uuid(),
  ...baseFields,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  ...baseFields,
});

async function assertReportOwner(supabase: any, userId: string, reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select("id, author_id, title")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rapport introuvable");
  if (data.author_id !== userId) throw new Error("Non autorisé");
  return data as { id: string; author_id: string; title: string };
}

async function nextMinuteNumber(supabase: any, reportId: string): Promise<string> {
  const { count } = await supabase
    .from("report_minutes")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId);
  const year = new Date().getFullYear();
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `PV-${year}-${seq}`;
}

export const listMinutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReportMinute[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("report_minutes")
      .select("*")
      .eq("report_id", data.reportId)
      .order("held_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ReportMinute[];
  });

export type MinuteListItem = ReportMinute & {
  report_title: string;
  report_date: string;
  report_author_id: string;
  author_name: string;
};

export const listAllMinutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MinuteListItem[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("report_minutes")
      .select("*")
      .order("held_at", { ascending: false });
    if (error) throw new Error(error.message);
    const minutes = (rows ?? []) as ReportMinute[];
    if (minutes.length === 0) return [];
    const reportIds = Array.from(new Set(minutes.map((m) => m.report_id)));
    const authorIds = Array.from(new Set(minutes.map((m) => m.author_id)));
    const [{ data: reps }, { data: profs }] = await Promise.all([
      supabase
        .from("reports")
        .select("id, title, report_date, author_id")
        .in("id", reportIds),
      supabase.from("profiles_public").select("id, full_name").in("id", authorIds),
    ]);
    const repMap = new Map<string, any>((reps ?? []).map((r: any) => [r.id, r]));
    const nameMap = new Map<string, string>(
      (profs ?? []).map((p: any) => [p.id, p.full_name || "Utilisateur"]),
    );
    return minutes.map((m) => {
      const r = repMap.get(m.report_id);
      return {
        ...m,
        report_title: r?.title ?? "Rapport",
        report_date: r?.report_date ?? m.held_at,
        report_author_id: r?.author_id ?? m.author_id,
        author_name: nameMap.get(m.author_id) ?? "Utilisateur",
      };
    });
  });

export type MinutesStats = {
  total: number;
  thisMonth: number;
  reportsWithMinutes: number;
  monthly: { month: string; count: number }[];
  byAuthor: { authorId: string; authorName: string; count: number }[];
};

export const getMinutesStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MinutesStats> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("report_minutes")
      .select("id, held_at, author_id, report_id");
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as {
      id: string;
      held_at: string;
      author_id: string;
      report_id: string;
    }[];
    const total = list.length;
    const now = new Date();
    const ym = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthKey = ym(now);
    let thisMonth = 0;
    const monthCounts = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthCounts.set(ym(d), 0);
    }
    const authorCounts = new Map<string, number>();
    for (const m of list) {
      const d = new Date(m.held_at);
      const key = ym(d);
      if (key === thisMonthKey) thisMonth++;
      if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
      authorCounts.set(m.author_id, (authorCounts.get(m.author_id) ?? 0) + 1);
    }
    const reportsWithMinutes = new Set(list.map((m) => m.report_id)).size;
    const authorIds = Array.from(authorCounts.keys());
    let nameMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles_public")
        .select("id, full_name")
        .in("id", authorIds);
      nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || "Utilisateur"]));
    }
    return {
      total,
      thisMonth,
      reportsWithMinutes,
      monthly: Array.from(monthCounts.entries()).map(([month, count]) => ({ month, count })),
      byAuthor: Array.from(authorCounts.entries())
        .map(([authorId, count]) => ({
          authorId,
          authorName: nameMap.get(authorId) ?? "Utilisateur",
          count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  });

export const getMinute = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ReportMinute> => {
    const { data: row, error } = await context.supabase
      .from("report_minutes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Procès-verbal introuvable");
    return row as ReportMinute;
  });

export const createMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    // Autorisation gérée par RLS (auteur, DG, ou destinataire d'un partage "edit")
    const number = data.number.trim() || (await nextMinuteNumber(supabase, data.reportId));
    const { data: row, error } = await supabase
      .from("report_minutes")
      .insert({
        report_id: data.reportId,
        author_id: userId,
        number,
        held_at: data.held_at,
        location: data.location,
        subject: data.subject,
        attendees: data.attendees,
        facts: data.facts,
        decisions: data.decisions,
        signer_name: data.signer_name,
        signer_role: data.signer_role,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Création impossible");
    return { id: row.id };
  });

export const updateMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("report_minutes")
      .update({
        number: data.number,
        held_at: data.held_at,
        location: data.location,
        subject: data.subject,
        attendees: data.attendees,
        facts: data.facts,
        decisions: data.decisions,
        signer_name: data.signer_name,
        signer_role: data.signer_role,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_minutes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateMinuteFactsFromReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ facts: string; decisions: string }> => {
    const { supabase } = context;
    const [{ data: report }, { data: sections }] = await Promise.all([
      supabase.from("reports").select("title, intro, conclusion").eq("id", data.reportId).maybeSingle(),
      supabase
        .from("report_sections")
        .select("title, description, position, id")
        .eq("report_id", data.reportId)
        .order("position", { ascending: true }),
    ]);
    if (!report) throw new Error("Rapport introuvable");
    const sectionIds = (sections ?? []).map((s: any) => s.id);
    const { data: bullets } = sectionIds.length
      ? await supabase
          .from("section_bullets")
          .select("section_id, content, position")
          .in("section_id", sectionIds)
          .order("position", { ascending: true })
      : { data: [] as any[] };
    const bulletsBySection: Record<string, string[]> = {};
    (bullets ?? []).forEach((b: any) => {
      (bulletsBySection[b.section_id] ??= []).push(b.content);
    });
    const lines: string[] = [];
    if (report.title) lines.push(`# ${report.title}`);
    if (report.intro) lines.push(`\n${report.intro}`);
    (sections ?? []).forEach((s: any) => {
      lines.push(`\n## ${s.title || "Section"}`);
      if (s.description) lines.push(s.description);
      (bulletsBySection[s.id] ?? []).forEach((c) => lines.push(`- ${c}`));
    });
    if (report.conclusion) lines.push(`\n${report.conclusion}`);

    const text = await callAI({
      model: DEFAULT_MODEL,
      system:
        "Tu rédiges des procès-verbaux officiels en français à partir de rapports d'activité. Réponds STRICTEMENT en JSON.",
      json: true,
      messages: [
        {
          role: "user",
          content:
            'À partir du rapport ci-dessous, rédige un brouillon de procès-verbal. Renvoie UNIQUEMENT ce JSON : {"facts": string, "decisions": string}. ' +
            "Les faits doivent être formulés à la 3e personne, factuels, chronologiques. Les décisions doivent lister les mesures prises ou à prendre.\n\nRAPPORT :\n" +
            lines.join("\n"),
        },
      ],
    });
    try {
      const parsed = JSON.parse(text);
      return {
        facts: String(parsed.facts ?? "").slice(0, 20000),
        decisions: String(parsed.decisions ?? "").slice(0, 20000),
      };
    } catch {
      return { facts: text.slice(0, 20000), decisions: "" };
    }
  });
