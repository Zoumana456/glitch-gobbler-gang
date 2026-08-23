/**
 * Mise à jour des soldes de congés. Utilise le client admin car le solde d'un
 * employé n'est modifiable que par le propriétaire selon les règles d'accès,
 * alors que la consommation est déclenchée par une validation hiérarchique.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureRow(
  companyId: string,
  userId: string,
  typeId: string,
  year: number,
) {
  const db = await admin();
  const { data } = await db
    .from("leave_balances")
    .select("id, allocated_days, used_days")
    .eq("user_id", userId)
    .eq("type_id", typeId)
    .eq("year", year)
    .maybeSingle();
  if (data) return data as any;

  const { data: type } = await db
    .from("leave_types")
    .select("default_days")
    .eq("id", typeId)
    .maybeSingle();
  const { data: created } = await db
    .from("leave_balances")
    .insert({
      company_id: companyId,
      user_id: userId,
      type_id: typeId,
      year,
      allocated_days: Number((type as any)?.default_days ?? 0),
      used_days: 0,
    })
    .select("id, allocated_days, used_days")
    .single();
  return created as any;
}

/** Ajoute des jours consommés après validation d'une absence. */
export async function consumeBalance(
  companyId: string,
  userId: string,
  typeId: string,
  days: number,
): Promise<void> {
  try {
    const year = new Date().getFullYear();
    const row = await ensureRow(companyId, userId, typeId, year);
    if (!row) return;
    const db = await admin();
    await db
      .from("leave_balances")
      .update({ used_days: Number(row.used_days ?? 0) + days })
      .eq("id", row.id);
  } catch (err) {
    console.error("[leaves] mise à jour du solde impossible", err);
  }
}

/** Restitue des jours après annulation d'une absence validée. */
export async function releaseBalance(
  companyId: string,
  userId: string,
  typeId: string,
  days: number,
): Promise<void> {
  try {
    const year = new Date().getFullYear();
    const row = await ensureRow(companyId, userId, typeId, year);
    if (!row) return;
    const db = await admin();
    await db
      .from("leave_balances")
      .update({ used_days: Math.max(0, Number(row.used_days ?? 0) - days) })
      .eq("id", row.id);
  } catch (err) {
    console.error("[leaves] restitution du solde impossible", err);
  }
}
