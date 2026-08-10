import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { TaskRow, TaskComment, TaskAssignee } from "@/lib/tasks.server";

export type { TaskRow, TaskComment, TaskAssignee };

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaskRow[]> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const { nameMap, decorate } = await import("@/lib/tasks.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "tasks",
    );
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const names = await nameMap(
      context.supabase,
      rows.flatMap((r: any) => [r.assignee_id, r.created_by]),
    );
    return decorate(rows, names);
  });

export const getTask = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      data,
      context,
    }): Promise<{ task: TaskRow; comments: TaskComment[] } | null> => {
      const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
      const { nameMap, decorate } = await import("@/lib/tasks.server");
      await assertModuleEnabled(context.supabase, context.userId, "tasks");
      const { data: row } = await context.supabase
        .from("tasks")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (!row) return null;
      const { data: comments } = await context.supabase
        .from("task_comments")
        .select("id, task_id, author_id, content, created_at")
        .eq("task_id", data.id)
        .order("created_at", { ascending: true });
      const names = await nameMap(context.supabase, [
        (row as any).assignee_id,
        (row as any).created_by,
        ...(comments ?? []).map((c: any) => c.author_id),
      ]);
      return {
        task: decorate([row], names)[0]!,
        comments: (comments ?? []).map((c: any) => ({
          id: c.id,
          task_id: c.task_id,
          author_id: c.author_id,
          author_name: names[c.author_id] ?? null,
          content: c.content,
          created_at: c.created_at,
        })),
      };
    },
  );

export const listTaskAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaskAssignee[]> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "tasks",
    );
    const { data: members } = await context.supabase
      .from("company_members")
      .select("user_id, position_title")
      .eq("company_id", companyId);
    const rows = members ?? [];
    const { nameMap } = await import("@/lib/tasks.server");
    const names = await nameMap(
      context.supabase,
      rows.map((m: any) => m.user_id),
    );
    return rows.map((m: any) => ({
      user_id: m.user_id,
      full_name: names[m.user_id] || "Sans nom",
      position_title: m.position_title ?? null,
    }));
  });

const TaskInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export const createTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TaskInput.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    const companyId = await assertModuleEnabled(
      context.supabase,
      context.userId,
      "tasks",
    );
    const { data: inserted, error } = await context.supabase
      .from("tasks")
      .insert({
        company_id: companyId,
        title: data.title,
        description: data.description ?? null,
        assignee_id: data.assigneeId ?? null,
        due_date: data.dueDate || null,
        priority: data.priority,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.assigneeId && data.assigneeId !== context.userId) {
      const { notify } = await import("@/lib/notifications.server");
      await notify([
        {
          user_id: data.assigneeId,
          type: "task_assigned",
          title: "Nouvelle tâche assignée",
          body: data.title,
          actor_id: context.userId,
        },
      ]);
    }
    return { id: inserted!.id as string };
  });

export const updateTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    TaskInput.extend({
      id: z.string().uuid(),
      status: z.enum(["todo", "in_progress", "done", "cancelled"]),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "tasks");
    const { error } = await context.supabase
      .from("tasks")
      .update({
        title: data.title,
        description: data.description ?? null,
        assignee_id: data.assigneeId ?? null,
        due_date: data.dueDate || null,
        priority: data.priority,
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "done", "cancelled"]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "tasks");
    const { data: before } = await context.supabase
      .from("tasks")
      .select("title, created_by, assignee_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.status === "done" && before && (before as any).created_by !== context.userId) {
      const { notify } = await import("@/lib/notifications.server");
      await notify([
        {
          user_id: (before as any).created_by,
          type: "task_completed",
          title: "Tâche terminée",
          body: (before as any).title,
          actor_id: context.userId,
        },
      ]);
    }
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "tasks");
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTaskComment = createServerFn({ method: "POST" })
  .inputValidator((d: { taskId: string; content: string }) =>
    z
      .object({ taskId: z.string().uuid(), content: z.string().trim().min(1).max(2000) })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { assertModuleEnabled } = await import("@/lib/modules/modules.server");
    await assertModuleEnabled(context.supabase, context.userId, "tasks");
    const { error } = await context.supabase.from("task_comments").insert({
      task_id: data.taskId,
      author_id: context.userId,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
