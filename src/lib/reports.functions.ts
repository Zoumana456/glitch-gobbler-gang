import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  LoadedImage,
  LoadedReport,
  LoadedSection,
  ReportListItem,
} from "./reports.types";

const IMAGE_URL_TTL = 60 * 60; // 1 hour

const bulletSchema = z.object({
  content: z.string().default(""),
  position: z.number().int().default(0),
});
const imageSchema = z.object({
  storage_path: z.string().min(1),
  section_index: z.number().int().nullable().default(null),
  position: z.number().int().default(0),
});
const sectionSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  position: z.number().int().default(0),
  bullets: z.array(bulletSchema).default([]),
});
const reportInputSchema = z.object({
  id: z.string().uuid().nullable().default(null),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1, "Le titre est requis"),
  intro: z.string().default(""),
  conclusion: z.string().default(""),
  sections: z.array(sectionSchema).default([]),
  images: z.array(imageSchema).default([]),
});

type ReportInput = z.infer<typeof reportInputSchema>;

async function signImages(
  supabase: any,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("report-images")
    .createSignedUrls(paths, IMAGE_URL_TTL);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry: any) => {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  });
  return map;
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReportListItem[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("reports")
      .select("id, author_id, report_date, title, intro, created_at")
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
    let profiles: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles_public")
        .select("id, full_name")
        .in("id", authorIds);
      profiles = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, p.full_name || "Utilisateur"]),
      );
    }
    return rows.map((r: any) => ({
      id: r.id,
      author_id: r.author_id,
      author_name: profiles[r.author_id] ?? "Utilisateur",
      report_date: r.report_date,
      title: r.title,
      intro: r.intro ?? "",
      created_at: r.created_at,
    }));
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<LoadedReport> => {
    const { supabase } = context;
    const [{ data: report, error: e1 }, { data: sections }, { data: images }] =
      await Promise.all([
        supabase.from("reports").select("*").eq("id", data.id).maybeSingle(),
        supabase
          .from("report_sections")
          .select("id, title, description, position, report_id")
          .eq("report_id", data.id)
          .order("position", { ascending: true }),
        supabase
          .from("report_images")
          .select("id, storage_path, section_id, position")
          .eq("report_id", data.id)
          .order("position", { ascending: true }),
      ]);
    if (e1) throw new Error(e1.message);
    if (!report) throw new Error("Rapport introuvable");

    const sectionIds = (sections ?? []).map((s: any) => s.id);
    const [{ data: bullets }, { data: profile }] = await Promise.all([
      sectionIds.length
        ? supabase
            .from("section_bullets")
            .select("id, section_id, content, position")
            .in("section_id", sectionIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("profiles_public")
        .select("id, full_name")
        .eq("id", report.author_id)
        .maybeSingle(),
    ]);

    const paths = (images ?? []).map((i: any) => i.storage_path);
    const urls = await signImages(supabase, paths);

    const bulletsBySection: Record<string, any[]> = {};
    (bullets ?? []).forEach((b: any) => {
      (bulletsBySection[b.section_id] ??= []).push(b);
    });
    const imagesBySection: Record<string, LoadedImage[]> = {};
    const generalImages: LoadedImage[] = [];
    (images ?? []).forEach((img: any) => {
      const li: LoadedImage = {
        id: img.id,
        storage_path: img.storage_path,
        section_id: img.section_id,
        position: img.position,
        url: urls[img.storage_path] ?? "",
      };
      if (img.section_id) (imagesBySection[img.section_id] ??= []).push(li);
      else generalImages.push(li);
    });

    const loadedSections: LoadedSection[] = (sections ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      position: s.position,
      bullets: (bulletsBySection[s.id] ?? []).map((b: any) => ({
        id: b.id,
        content: b.content,
        position: b.position,
      })),
      images: imagesBySection[s.id] ?? [],
    }));

    return {
      id: report.id,
      author_id: report.author_id,
      author_name: profile?.full_name || "Utilisateur",
      author_email: "",
      report_date: report.report_date,
      title: report.title,
      intro: report.intro ?? "",
      conclusion: report.conclusion ?? "",
      created_at: report.created_at,
      updated_at: report.updated_at,
      sections: loadedSections,
      general_images: generalImages,
    };
  });

async function persistChildren(
  supabase: any,
  reportId: string,
  input: ReportInput,
) {
  // Wipe children (RLS ensures only own report)
  await supabase.from("report_sections").delete().eq("report_id", reportId);
  await supabase.from("report_images").delete().eq("report_id", reportId);

  // Insert sections and gather created IDs (ordered by position)
  const sectionInserts = input.sections.map((s, idx) => ({
    report_id: reportId,
    title: s.title,
    description: s.description,
    position: idx,
  }));
  let insertedSections: { id: string }[] = [];
  if (sectionInserts.length > 0) {
    const { data, error } = await supabase
      .from("report_sections")
      .insert(sectionInserts)
      .select("id");
    if (error) throw new Error(error.message);
    insertedSections = data ?? [];
  }

  const bulletInserts: any[] = [];
  input.sections.forEach((s, sIdx) => {
    const secId = insertedSections[sIdx]?.id;
    if (!secId) return;
    s.bullets.forEach((b, bIdx) => {
      const content = (b.content ?? "").trim();
      if (!content) return;
      bulletInserts.push({ section_id: secId, content, position: bIdx });
    });
  });
  if (bulletInserts.length > 0) {
    const { error } = await supabase.from("section_bullets").insert(bulletInserts);
    if (error) throw new Error(error.message);
  }

  const imageInserts = input.images.map((img, idx) => ({
    report_id: reportId,
    section_id:
      img.section_index !== null ? insertedSections[img.section_index]?.id ?? null : null,
    storage_path: img.storage_path,
    position: idx,
  }));
  if (imageInserts.length > 0) {
    const { error } = await supabase.from("report_images").insert(imageInserts);
    if (error) throw new Error(error.message);
  }
}

export const upsertReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reportInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let reportId: string;
    if (data.id) {
      const { data: upd, error } = await supabase
        .from("reports")
        .update({
          report_date: data.report_date,
          title: data.title,
          intro: data.intro,
          conclusion: data.conclusion,
        })
        .eq("id", data.id)
        .eq("author_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!upd) throw new Error("Rapport introuvable ou non autorisé");
      reportId = upd.id;
    } else {
      const { data: ins, error } = await supabase
        .from("reports")
        .insert({
          author_id: userId,
          report_date: data.report_date,
          title: data.title,
          intro: data.intro,
          conclusion: data.conclusion,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      reportId = ins.id;
    }
    await persistChildren(supabase, reportId, data);
    return { id: reportId };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", data.id)
      .eq("author_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data;
    const email = (claims as any)?.email ?? null;
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ id: userId, email, full_name: email?.split("@")[0] ?? "" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { full_name?: string; avatar_url?: string | null }) =>
    z
      .object({ full_name: z.string().optional(), avatar_url: z.string().nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return prof;
  });
