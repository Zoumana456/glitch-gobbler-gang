import type { SupabaseClient } from "@supabase/supabase-js";
import { OPTIONAL_MODULE_CODES } from "./registry";

export type ModuleState = {
  companyId: string | null;
  isOwner: boolean;
  /** codes des modules désactivés pour l'entreprise */
  disabled: string[];
};

export async function loadModuleState(
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<ModuleState> {
  const { data: mem } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem?.company_id) return { companyId: null, isOwner: false, disabled: [] };

  const [{ data: company }, { data: rows }] = await Promise.all([
    supabase.from("companies").select("owner_id").eq("id", mem.company_id).maybeSingle(),
    supabase
      .from("company_modules")
      .select("module_code, enabled")
      .eq("company_id", mem.company_id),
  ]);

  const disabled = (rows ?? [])
    .filter((r: any) => r.enabled === false)
    .map((r: any) => r.module_code as string)
    .filter((code: string) => OPTIONAL_MODULE_CODES.includes(code));

  return {
    companyId: mem.company_id as string,
    isOwner: (company as any)?.owner_id === userId,
    disabled,
  };
}

/** Jette si le module est désactivé pour l'entreprise de l'utilisateur. */
export async function assertModuleEnabled(
  supabase: SupabaseClient<any>,
  userId: string,
  code: string,
): Promise<string> {
  const state = await loadModuleState(supabase, userId);
  if (!state.companyId) throw new Error("Vous devez appartenir à une entreprise");
  if (state.disabled.includes(code))
    throw new Error("Cette application est désactivée pour votre entreprise");
  return state.companyId;
}
