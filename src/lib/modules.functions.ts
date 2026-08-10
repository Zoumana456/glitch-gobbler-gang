import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ModuleState } from "@/lib/modules/modules.server";

export type { ModuleState };

export const getMyModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModuleState> => {
    const { loadModuleState } = await import("@/lib/modules/modules.server");
    return loadModuleState(context.supabase, context.userId);
  });

export const setModuleEnabled = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; enabled: boolean }) =>
    z.object({ code: z.string().min(1).max(60), enabled: z.boolean() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { OPTIONAL_MODULE_CODES } = await import("@/lib/modules/registry");
    if (!OPTIONAL_MODULE_CODES.includes(data.code))
      throw new Error("Cette application ne peut pas être désactivée");

    const { loadModuleState } = await import("@/lib/modules/modules.server");
    const state = await loadModuleState(context.supabase, context.userId);
    if (!state.companyId) throw new Error("Vous devez appartenir à une entreprise");
    if (!state.isOwner)
      throw new Error("Seul le propriétaire de l'entreprise peut gérer les applications");

    const { error } = await context.supabase.from("company_modules").upsert(
      {
        company_id: state.companyId,
        module_code: data.code,
        enabled: data.enabled,
      },
      { onConflict: "company_id,module_code" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
