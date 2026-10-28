import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STEPS, MAX_ATTEMPTS, executeStep, type RunRow } from "./pipeline.server";

const startInput = z.object({
  report_type: z.enum(["activite", "projets", "depenses", "synthese"]),
  title: z.string().min(2).max(200),
  instructions: z.string().max(4000).default(""),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(z.enum(["projects", "expenses", "tasks", "reports"])).min(1),
});

export const startAgentRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => startInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.period_start > data.period_end) throw new Error("La date de début doit précéder la date de fin.");
    // Protection contre les doublons : une exécution active à la fois.
    const { data: active } = await sb
      .from("report_runs")
      .select("id")
      .eq("requested_by", context.userId)
      .in("status", ["pending", "planning", "running"])
      .limit(1);
    if (active?.length) throw new Error("Une exécution est déjà en cours. Attendez sa fin ou annulez-la.");

    const { data: agents } = await sb.from("ai_agents").select("code,is_enabled");
    const disabled = new Set((agents ?? []).filter((a) => !a.is_enabled).map((a) => a.code));
    if (disabled.has("orchestrator")) throw new Error("L'Orchestrateur est désactivé.");

    const { data: mem } = await sb.from("company_members").select("company_id").eq("user_id", context.userId).limit(1);
    const { data: run, error } = await sb
      .from("report_runs")
      .insert({
        requested_by: context.userId,
        company_id: mem?.[0]?.company_id ?? null,
        ...data,
        status: "planning",
        current_step: "plan",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("agent_tasks").insert(
      STEPS.map((s, i) => ({
        run_id: run.id,
        agent_code: s.agent,
        task_type: s.type,
        position: i,
        status: disabled.has(s.agent) ? "skipped" : "pending",
      })),
    );
    await sb.from("report_run_audit_logs").insert({
      run_id: run.id,
      actor_type: "user",
      actor_id: context.userId,
      event_type: "run_created",
      event_details: { report_type: data.report_type, sources: data.sources },
    });
    return { id: run.id };
  });

// L'Orchestrateur exécute la prochaine tâche en attente (une par appel, pour suivre la progression).
export const advanceAgentRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: run } = await sb.from("report_runs").select("*").eq("id", data.id).single();
    if (!run) throw new Error("Exécution introuvable.");
    if (!["planning", "running"].includes(run.status)) return { done: true, status: run.status };

    const { data: tasks } = await sb.from("agent_tasks").select("*").eq("run_id", run.id).order("position");
    const next = (tasks ?? []).find((t) => t.status === "pending" || t.status === "retrying");
    const audit = (event_type: string, event_details: Record<string, unknown>, actor = "orchestrator") =>
      sb.from("report_run_audit_logs").insert({ run_id: run.id, actor_type: "agent", actor_id: actor, event_type, event_details: event_details as any });

    if (!next) {
      const status = run.quality_status === "AVERTISSEMENT" ? "completed_with_warnings" : "completed";
      await sb.from("report_runs").update({ status, current_step: null, completed_at: new Date().toISOString() }).eq("id", run.id);
      await audit("run_completed", { status });
      return { done: true, status };
    }

    const attempt = next.attempt_count + 1;
    await sb.from("agent_tasks").update({ status: "running", attempt_count: attempt, started_at: new Date().toISOString() }).eq("id", next.id);
    await sb.from("report_runs").update({ status: "running", current_step: next.task_type }).eq("id", run.id);
    await audit("task_started", { task: next.task_type, attempt }, next.agent_code);

    try {
      const res = await executeStep(next.task_type, run as unknown as RunRow, sb as any);
      const state = { ...((run.state as any) ?? {}), [next.task_type]: res.output };
      await sb.from("agent_tasks").update({ status: "done", output: res.output as any, error_message: null, completed_at: new Date().toISOString() }).eq("id", next.id);
      const patch: Record<string, any> = { state };
      if (res.quality) patch.quality_status = res.quality;
      if (res.reportId) patch.result_report_id = res.reportId;
      await sb.from("report_runs").update(patch).eq("id", run.id);
      await audit("task_done", { task: next.task_type }, next.agent_code);

      if (res.quality === "REJETÉ") {
        const msg = (res.output.controles ?? []).filter((c: any) => c.niveau === "bloquant").map((c: any) => c.message).join(" ");
        await sb.from("agent_tasks").update({ status: "cancelled" }).eq("run_id", run.id).eq("status", "pending");
        await sb.from("report_runs").update({ status: "failed", error_summary: `Contrôle qualité rejeté : ${msg}`, completed_at: new Date().toISOString() }).eq("id", run.id);
        await audit("publication_refused", { reason: msg });
        return { done: true, status: "failed" };
      }
      return { done: false, status: "running" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_ATTEMPTS) {
        await sb.from("agent_tasks").update({ status: "retrying", error_message: msg }).eq("id", next.id);
        await audit("task_retry", { task: next.task_type, error: msg }, next.agent_code);
        return { done: false, status: "running" };
      }
      await sb.from("agent_tasks").update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() }).eq("id", next.id);
      await sb.from("agent_tasks").update({ status: "cancelled" }).eq("run_id", run.id).eq("status", "pending");
      await sb.from("report_runs").update({ status: "failed", error_summary: `${next.task_type} : ${msg}`, completed_at: new Date().toISOString() }).eq("id", run.id);
      await audit("run_failed", { task: next.task_type, error: msg });
      return { done: true, status: "failed" };
    }
  });

export const cancelAgentRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await sb.from("report_runs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", data.id).in("status", ["pending", "planning", "running"]);
    await sb.from("agent_tasks").update({ status: "cancelled" }).eq("run_id", data.id).in("status", ["pending", "retrying"]);
    await sb.from("report_run_audit_logs").insert({ run_id: data.id, actor_type: "user", actor_id: context.userId, event_type: "run_cancelled" });
    return { ok: true };
  });

export const getAgentCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [agents, runs, tasks] = await Promise.all([
      sb.from("ai_agents").select("code,name,role,description,is_enabled,position").order("position"),
      sb.from("report_runs").select("id,title,report_type,status,current_step,quality_status,period_start,period_end,error_summary,result_report_id,created_at,started_at,completed_at").order("created_at", { ascending: false }).limit(30),
      sb.from("agent_tasks").select("agent_code,status,run_id,started_at,completed_at").limit(1000),
    ]);
    const stats: Record<string, { done: number; failed: number; running: number; last: string | null }> = {};
    for (const t of tasks.data ?? []) {
      const s = (stats[t.agent_code] ??= { done: 0, failed: 0, running: 0, last: null });
      if (t.status === "done") s.done++;
      if (t.status === "failed") s.failed++;
      if (t.status === "running") s.running++;
      if (t.completed_at && (!s.last || t.completed_at > s.last)) s.last = t.completed_at;
    }
    return { agents: agents.data ?? [], runs: runs.data ?? [], stats };
  });

export const getAgentRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [run, tasks, logs] = await Promise.all([
      sb.from("report_runs").select("*").eq("id", data.id).single(),
      sb.from("agent_tasks").select("*").eq("run_id", data.id).order("position"),
      sb.from("report_run_audit_logs").select("*").eq("run_id", data.id).order("created_at"),
    ]);
    if (!run.data) throw new Error("Exécution introuvable.");
    return { run: run.data as any, tasks: (tasks.data ?? []) as any[], logs: (logs.data ?? []) as any[] };
  });
