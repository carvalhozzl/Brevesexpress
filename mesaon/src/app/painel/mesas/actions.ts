"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { userMessage } from "@/lib/errors";
import { fieldErrors, formToObject, uuidSchema, type ActionState } from "@/lib/validation/common";
import { buildBulkLabels, bulkTablesSchema, createTableSchema, updateTableSchema } from "@/lib/validation/tables";

const FORBIDDEN: ActionState = { ok: false, message: userMessage({ message: "FORBIDDEN" }) };

async function managerContext() {
  const ctx = await getPanelContext();
  return canManage(ctx.role) ? ctx : null;
}

export async function createTableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return FORBIDDEN;
  const parsed = createTableSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: formToObject(formData) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("restaurant_tables").insert({ restaurant_id: ctx.restaurant.id, label: parsed.data.label });
  if (error) {
    const code = error.code === "23505" ? "Já existe uma mesa com este nome." : userMessage(error);
    return { ok: false, fieldErrors: error.code === "23505" ? { label: code } : undefined, message: error.code === "23505" ? undefined : code, values: formToObject(formData) };
  }
  revalidatePath("/painel/mesas");
  return { ok: true, message: `Mesa “${parsed.data.label}” criada.` };
}

export async function createTablesBulkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return FORBIDDEN;
  const parsed = bulkTablesSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: formToObject(formData) };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("restaurant_tables").select("label").eq("restaurant_id", ctx.restaurant.id);
  const taken = new Set((existing ?? []).map((t) => t.label.trim().toLowerCase()));
  const labels = buildBulkLabels(parsed.data.from, parsed.data.to, parsed.data.prefix).filter((l) => !taken.has(l.toLowerCase()));
  if (labels.length === 0) return { ok: false, message: "Todas essas mesas já existem." };

  // inserção uma a uma para respeitar o limite do plano e criar o máximo possível
  let created = 0;
  let limitReached = false;
  for (const label of labels) {
    const { error } = await supabase.from("restaurant_tables").insert({ restaurant_id: ctx.restaurant.id, label });
    if (error) {
      if (error.message === "PLAN_TABLE_LIMIT") {
        limitReached = true;
        break;
      }
      if (error.code === "23505") continue;
      revalidatePath("/painel/mesas");
      return { ok: false, message: `${created} mesa(s) criada(s). ${userMessage(error)}` };
    }
    created++;
  }
  revalidatePath("/painel/mesas");
  if (limitReached) {
    return { ok: created > 0, message: `${created} mesa(s) criada(s). ${userMessage({ message: "PLAN_TABLE_LIMIT" })}` };
  }
  return { ok: true, message: `${created} mesa(s) criada(s).` };
}

export async function updateTableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return FORBIDDEN;
  const parsed = updateTableSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({ label: parsed.data.label, nfc_tag_id: parsed.data.nfcTagId || null })
    .eq("id", parsed.data.id)
    .eq("restaurant_id", ctx.restaurant.id)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { label: "Já existe uma mesa com este nome." } };
    return { ok: false, message: userMessage(error) };
  }
  if (!data?.length) return { ok: false, message: userMessage({ message: "NOT_FOUND" }) };
  revalidatePath("/painel/mesas");
  return { ok: true, message: "Mesa atualizada." };
}

export async function setTableActiveAction(tableId: string, isActive: boolean): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx || !uuidSchema.safeParse(tableId).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({ is_active: isActive })
    .eq("id", tableId)
    .eq("restaurant_id", ctx.restaurant.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: userMessage(error ?? { message: "NOT_FOUND" }) };
  revalidatePath("/painel/mesas");
  return { ok: true, message: isActive ? "Mesa ativada." : "Mesa desativada. O QR Code dela deixa de aceitar chamadas." };
}

export async function deleteTableAction(tableId: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx || !uuidSchema.safeParse(tableId).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("restaurant_tables").delete().eq("id", tableId).eq("restaurant_id", ctx.restaurant.id).select("id");
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Esta mesa tem histórico de chamadas e não pode ser excluída. Desative-a para que deixe de receber chamadas." };
    }
    return { ok: false, message: userMessage(error) };
  }
  if (!data?.length) return { ok: false, message: userMessage({ message: "NOT_FOUND" }) };
  revalidatePath("/painel/mesas");
  return { ok: true, message: "Mesa excluída." };
}

export async function regenerateTokenAction(tableId: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx || !uuidSchema.safeParse(tableId).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("regenerate_table_token", { p_table_id: tableId });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/mesas");
  return { ok: true, message: "Novo QR Code gerado. Imprima a nova etiqueta e regrave a tag NFC — o código antigo deixou de funcionar." };
}

export async function markNfcLinkedAction(tableId: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx || !uuidSchema.safeParse(tableId).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ nfc_linked_at: new Date().toISOString() })
    .eq("id", tableId)
    .eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/mesas");
  return { ok: true, message: "Tag NFC registrada para esta mesa." };
}
