import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type MailTemplate = {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  subject: string;
  body_html: string;
  scope: "personal" | "company";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MailSignature = {
  id: string;
  account_id: string;
  name: string;
  body_html: string;
  is_default: boolean;
  created_at: string;
};

/* ---------------------------- Modèles ---------------------------- */

export const listMailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailTemplate[]> => {
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as MailTemplate[];
  });

export const saveMailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(120),
        subject: z.string().max(300).default(""),
        body: z.string().max(200_000).default(""),
        scope: z.enum(["personal", "company"]).default("personal"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    let companyId: string | null = null;
    if (data.scope === "company") {
      const { data: member } = await context.supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", context.userId)
        .limit(1)
        .maybeSingle();
      companyId = (member as { company_id: string } | null)?.company_id ?? null;
      if (!companyId)
        throw new Error("Vous devez appartenir à une entreprise pour partager un modèle.");
    }

    const payload = {
      user_id: context.userId,
      company_id: companyId,
      name: data.name,
      subject: data.subject,
      body_html: data.body,
      scope: data.scope,
    };
    const q = data.id
      ? context.supabase
          .from("email_templates")
          .update(payload as never)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select("id")
          .single()
      : context.supabase.from("email_templates").insert(payload as never).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteMailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("email_templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Signatures --------------------------- */

export const listMailSignatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailSignature[]> => {
    const { data, error } = await context.supabase
      .from("email_signatures")
      .select("id, account_id, name, body_html, is_default, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as MailSignature[];
  });

export const saveMailSignature = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        accountId: z.string().uuid(),
        name: z.string().min(1).max(120),
        body: z.string().max(20_000).default(""),
        isDefault: z.boolean().default(false),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const payload = {
      user_id: context.userId,
      account_id: data.accountId,
      name: data.name,
      body_html: data.body,
      is_default: data.isDefault,
    };
    const q = data.id
      ? context.supabase
          .from("email_signatures")
          .update(payload as never)
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .select("id")
          .single()
      : context.supabase.from("email_signatures").insert(payload as never).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    const id = (row as { id: string }).id;

    if (data.isDefault) {
      await context.supabase
        .from("email_signatures")
        .update({ is_default: false } as never)
        .eq("user_id", context.userId)
        .eq("account_id", data.accountId)
        .neq("id", id);
    }
    return { id };
  });

export const deleteMailSignature = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("email_signatures")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
