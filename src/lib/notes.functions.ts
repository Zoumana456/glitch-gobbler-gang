import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReportNote = {
  id: string;
  report_id: string;
  section_id: string | null;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export const listReportNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) =>
    z.object({ reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ReportNote[]> => {
    const { supabase } = context;
    const { data: notes } = await supabase
      .from("report_notes")
      .select("id, report_id, section_id, author_id, content, created_at, updated_at")
      .eq("report_id", data.reportId)
      .order("created_at", { ascending: true });
    const authorIds = Array.from(new Set((notes ?? []).map((n: any) => n.author_id)));
    let profMap: Record<string, string> = {};
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles_public")
        .select("id, full_name")
        .in("id", authorIds);
      profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || "Utilisateur"]));
    }
    return (notes ?? []).map((n: any) => ({
      ...n,
      author_name: profMap[n.author_id] ?? "Utilisateur",
    }));
  });

export const createReportNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; sectionId?: string | null; content: string }) =>
    z
      .object({
        reportId: z.string().uuid(),
        sectionId: z.string().uuid().nullable().optional(),
        content: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: note, error } = await supabase
      .from("report_notes")
      .insert({
        report_id: data.reportId,
        section_id: data.sectionId ?? null,
        author_id: userId,
        content: data.content,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return note;
  });

export const updateReportNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; content: string }) =>
    z.object({ id: z.string().uuid(), content: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_notes")
      .update({ content: data.content })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReportNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_notes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
