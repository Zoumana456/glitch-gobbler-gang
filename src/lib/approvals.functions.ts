import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ApprovalEntry, PendingApproval } from "./reports.types";

const reportIdSchema = z.object({ reportId: z.string().uuid() });

/** Soumet un rapport à la hiérarchie. Auto-validé si l'auteur est au sommet. */
export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) => reportIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { getMemberRow, listMembers, nextApproverOf } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report } = await supabaseAdmin
      .from("reports")
      .select("id, author_id, status, company_id, title")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) throw new Error("Rapport introuvable.");
    if (report.author_id !== context.userId) throw new Error("Seul l'auteur peut soumettre ce rapport.");
    if (report.status === "submitted" || report.status === "in_review") {
      throw new Error("Ce rapport est déjà en cours de validation.");
    }
    if (report.status === "approved") throw new Error("Ce rapport est déjà validé.");

    const me = await getMemberRow(context.userId);
    if (!me) throw new Error("Vous devez appartenir à une entreprise pour soumettre un rapport.");
    const members = await listMembers(me.company_id);
    const approver = nextApproverOf(members, me);

    const now = new Date().toISOString();
    const patch = approver
      ? {
          status: "submitted",
          current_approver_id: approver.user_id,
          submitted_at: now,
          approved_at: null,
          company_id: me.company_id,
        }
      : {
          status: "approved",
          current_approver_id: null,
          submitted_at: now,
          approved_at: now,
          company_id: me.company_id,
        };

    const { error } = await supabaseAdmin.from("reports").update(patch).eq("id", report.id);
    if (error) throw new Error(error.message);

    const log: any[] = [
      {
        report_id: report.id,
        approver_id: context.userId,
        level: me.hierarchy_level,
        decision: "submitted",
        comment: null,
      },
    ];
    if (!approver) {
      log.push({
        report_id: report.id,
        approver_id: context.userId,
        level: me.hierarchy_level,
        decision: "approved",
        comment: "Validation automatique (aucun niveau supérieur).",
      });
    }
    await supabaseAdmin.from("report_approvals").insert(log);

    const { notify } = await import("./notifications.server");
    const { nameMap } = await import("./hierarchy.server");
    if (approver) {
      const names = await nameMap([context.userId]);
      await notify([
        {
          user_id: approver.user_id,
          type: "report_submitted",
          title: "Un rapport attend votre validation",
          body: `${names[context.userId] ?? "Un collaborateur"} a soumis « ${report.title} ».`,
          report_id: report.id,
          actor_id: context.userId,
        },
      ]);
    }

    return {
      ok: true,
      status: patch.status,
      approverName: approver ? null : undefined,
    };
  });

/** Valide le rapport et le fait remonter au niveau supérieur, s'il en existe un. */
export const approveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; comment?: string }) =>
    reportIdSchema.extend({ comment: z.string().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getMemberRow, listMembers, nextApproverOf } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report } = await supabaseAdmin
      .from("reports")
      .select("id, author_id, status, current_approver_id, title")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) throw new Error("Rapport introuvable.");
    if (report.author_id === context.userId) throw new Error("Vous ne pouvez pas valider votre propre rapport.");
    if (report.current_approver_id !== context.userId) {
      throw new Error("Ce rapport n'est pas en attente de votre validation.");
    }

    const me = await getMemberRow(context.userId);
    if (!me) throw new Error("Membre introuvable.");
    const members = await listMembers(me.company_id);
    const next = nextApproverOf(members, me);

    const now = new Date().toISOString();
    const patch = next
      ? { status: "in_review", current_approver_id: next.user_id }
      : { status: "approved", current_approver_id: null, approved_at: now };

    const { error } = await supabaseAdmin.from("reports").update(patch).eq("id", report.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("report_approvals").insert({
      report_id: report.id,
      approver_id: context.userId,
      level: me.hierarchy_level,
      decision: "approved",
      comment: data.comment?.trim() || null,
    });

    const { notify } = await import("./notifications.server");
    const { nameMap } = await import("./hierarchy.server");
    const names = await nameMap([context.userId, report.author_id]);
    const actor = names[context.userId] ?? "Un responsable";
    const drafts: any[] = [
      {
        user_id: report.author_id,
        type: "report_approved",
        title: next
          ? "Votre rapport a été validé et transmis"
          : "Votre rapport a été validé",
        body: next
          ? `${actor} a validé « ${report.title} ». Il est transmis au niveau supérieur.`
          : `${actor} a validé « ${report.title} ». Le circuit de validation est terminé.`,
        report_id: report.id,
        actor_id: context.userId,
      },
    ];
    if (next) {
      drafts.push({
        user_id: next.user_id,
        type: "report_submitted",
        title: "Un rapport attend votre validation",
        body: `« ${report.title} » de ${names[report.author_id] ?? "un collaborateur"} vous a été transmis.`,
        report_id: report.id,
        actor_id: context.userId,
      });
    }
    await notify(drafts);

    return { ok: true, status: patch.status, escalated: !!next };
  });

/** Rejette le rapport : retour à l'auteur avec un commentaire obligatoire. */
export const rejectReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; comment: string }) =>
    reportIdSchema.extend({ comment: z.string().min(3, "Un motif est requis").max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getMemberRow } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report } = await supabaseAdmin
      .from("reports")
      .select("id, current_approver_id, author_id, title")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) throw new Error("Rapport introuvable.");
    if (report.current_approver_id !== context.userId) {
      throw new Error("Ce rapport n'est pas en attente de votre validation.");
    }
    const me = await getMemberRow(context.userId);

    const { error } = await supabaseAdmin
      .from("reports")
      .update({ status: "rejected", current_approver_id: null })
      .eq("id", report.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("report_approvals").insert({
      report_id: report.id,
      approver_id: context.userId,
      level: me?.hierarchy_level ?? 4,
      decision: "rejected",
      comment: data.comment.trim(),
    });

    const { notify } = await import("./notifications.server");
    const { nameMap } = await import("./hierarchy.server");
    const names = await nameMap([context.userId]);
    await notify([
      {
        user_id: report.author_id,
        type: "report_rejected",
        title: "Votre rapport a été renvoyé",
        body: `${names[context.userId] ?? "Un responsable"} a demandé des corrections sur « ${report.title} » : ${data.comment.trim()}`,
        report_id: report.id,
        actor_id: context.userId,
      },
    ]);
    return { ok: true };
  });

/** Rapports en attente de ma validation. */
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingApproval[]> => {
    const { listMembers, getMemberRow, nameMap } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reports")
      .select("id, title, report_date, author_id, status, kind, submitted_at")
      .eq("current_approver_id", context.userId)
      .in("status", ["submitted", "in_review"])
      .order("submitted_at", { ascending: true });
    if (!rows || rows.length === 0) return [];

    const me = await getMemberRow(context.userId);
    const members = me ? await listMembers(me.company_id) : [];
    const positions = Object.fromEntries(
      members.map((m) => [m.user_id, m.position_title ?? ""]),
    );
    const names = await nameMap(rows.map((r: any) => r.author_id));

    return rows.map((r: any) => ({
      report_id: r.id,
      title: r.title,
      report_date: r.report_date,
      author_id: r.author_id,
      author_name: names[r.author_id] ?? "Utilisateur",
      author_position: positions[r.author_id] ?? "",
      status: r.status,
      kind: r.kind,
      submitted_at: r.submitted_at,
    }));
  });

/** Fil de validation d'un rapport. */
export const getApprovalTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) => reportIdSchema.parse(d))
  .handler(async ({ data, context }): Promise<ApprovalEntry[]> => {
    const { nameMap } = await import("./hierarchy.server");
    const { data: rows, error } = await context.supabase
      .from("report_approvals")
      .select("id, approver_id, level, decision, comment, decided_at")
      .eq("report_id", data.reportId)
      .order("decided_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];
    const names = await nameMap(rows.map((r: any) => r.approver_id));
    return rows.map((r: any) => ({
      id: r.id,
      approver_id: r.approver_id,
      approver_name: names[r.approver_id] ?? "Utilisateur",
      level: r.level,
      decision: r.decision,
      comment: r.comment,
      decided_at: r.decided_at,
    }));
  });

export type ConsolidationCandidate = {
  report_id: string;
  title: string;
  report_date: string;
  author_id: string;
  author_name: string;
  status: string;
};

/** Rapports de mon équipe éligibles à une synthèse sur une période. */
export const listConsolidationCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ConsolidationCandidate[]> => {
    const { getMemberRow, listMembers, nameMap, visibleMembers } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) return [];
    const members = await listMembers(me.company_id);
    const team = visibleMembers(members, me);
    if (team.length === 0) return [];
    const ids = team.map((m) => m.user_id);
    const [{ data: rows }, names] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id, title, report_date, author_id, status")
        .in("author_id", ids)
        .eq("kind", "individual")
        .in("status", ["approved", "in_review"])
        .gte("report_date", data.from)
        .lte("report_date", data.to)
        .order("report_date", { ascending: false }),
      nameMap(ids),
    ]);
    return (rows ?? []).map((r: any) => ({
      report_id: r.id,
      title: r.title,
      report_date: r.report_date,
      author_id: r.author_id,
      author_name: names[r.author_id] ?? "Utilisateur",
      status: r.status,
    }));
  });

/** Crée un rapport de synthèse agrégeant les rapports sélectionnés. */
export const createConsolidatedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { title: string; from: string; to: string; reportIds: string[]; intro?: string }) =>
      z
        .object({
          title: z.string().min(3).max(200),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reportIds: z.array(z.string().uuid()).min(1, "Sélectionnez au moins un rapport"),
          intro: z.string().max(5000).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getMemberRow, listMembers, nameMap, visibleMembers } = await import("./hierarchy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await getMemberRow(context.userId);
    if (!me) throw new Error("Vous devez appartenir à une entreprise.");
    if (me.hierarchy_level > 3) throw new Error("Seuls les responsables et la direction peuvent consolider.");

    const members = await listMembers(me.company_id);
    const allowed = new Set(visibleMembers(members, me).map((m) => m.user_id));
    const { data: sources } = await supabaseAdmin
      .from("reports")
      .select("id, title, author_id, report_date, intro, conclusion")
      .in("id", data.reportIds);
    const rows = sources ?? [];
    if (rows.length === 0) throw new Error("Aucun rapport source valide.");
    if (rows.some((r: any) => !allowed.has(r.author_id))) {
      throw new Error("Un des rapports ne fait pas partie de votre équipe.");
    }

    const names = await nameMap(rows.map((r: any) => r.author_id));
    const { data: created, error } = await supabaseAdmin
      .from("reports")
      .insert({
        author_id: context.userId,
        company_id: me.company_id,
        report_date: data.to,
        period_start: data.from,
        period_end: data.to,
        kind: "consolidated",
        status: "draft",
        title: data.title,
        intro:
          data.intro?.trim() ||
          `Synthèse consolidée du ${data.from} au ${data.to} — ${rows.length} rapport(s) d'équipe.`,
        conclusion: "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const sectionInserts = rows
      .sort((a: any, b: any) => a.report_date.localeCompare(b.report_date))
      .map((r: any, idx: number) => ({
        report_id: created.id,
        title: `${names[r.author_id] ?? "Utilisateur"} — ${r.report_date}`,
        description: [r.intro, r.conclusion].filter(Boolean).join("\n\n") || r.title,
        position: idx,
      }));
    if (sectionInserts.length > 0) {
      await supabaseAdmin.from("report_sections").insert(sectionInserts);
    }
    await supabaseAdmin.from("report_sources").insert(
      rows.map((r: any) => ({ consolidated_report_id: created.id, source_report_id: r.id })),
    );

    return { ok: true, reportId: created.id as string };
  });
