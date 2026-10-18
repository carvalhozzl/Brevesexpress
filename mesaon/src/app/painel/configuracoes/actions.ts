"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { authMessage, userMessage } from "@/lib/errors";
import { fieldErrors, formToObject, uuidSchema, type ActionState } from "@/lib/validation/common";
import { updateRestaurantSchema } from "@/lib/validation/restaurant";
import { serviceTypeSchema, updateServiceTypeSchema } from "@/lib/validation/service-types";
import { resetPasswordSchema } from "@/lib/validation/auth";

const FORBIDDEN: ActionState = { ok: false, message: userMessage({ message: "FORBIDDEN" }) };

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getPanelContext();
  const parsed = z.object({ fullName: z.string().trim().min(2, "Informe seu nome").max(100) }).safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", ctx.user.id);
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel", "layout");
  return { ok: true, message: "Nome atualizado." };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getPanelContext();
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: authMessage(error) };
  return { ok: true, message: "Senha alterada." };
}

export async function updateRestaurantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return FORBIDDEN;
  const parsed = updateRestaurantSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone })
    .eq("id", ctx.restaurant.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: userMessage(error ?? { message: "FORBIDDEN" }) };
  revalidatePath("/painel", "layout");
  return { ok: true, message: "Dados do estabelecimento atualizados." };
}

export async function createServiceTypeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return FORBIDDEN;
  const parsed = serviceTypeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: formToObject(formData) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_types").insert({
    restaurant_id: ctx.restaurant.id,
    name: parsed.data.name,
    icon: parsed.data.icon,
    sort_order: parsed.data.sortOrder,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: "Já existe um tipo com este nome." }, values: formToObject(formData) };
    return { ok: false, message: userMessage(error) };
  }
  revalidatePath("/painel/configuracoes");
  return { ok: true, message: `“${parsed.data.name}” adicionado. Já aparece para os clientes nas mesas.` };
}

export async function updateServiceTypeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return FORBIDDEN;
  const parsed = updateServiceTypeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_types")
    .update({ name: parsed.data.name, icon: parsed.data.icon, sort_order: parsed.data.sortOrder })
    .eq("id", parsed.data.id)
    .eq("restaurant_id", ctx.restaurant.id)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: "Já existe um tipo com este nome." } };
    return { ok: false, message: userMessage(error) };
  }
  if (!data?.length) return { ok: false, message: userMessage({ message: "NOT_FOUND" }) };
  revalidatePath("/painel/configuracoes");
  return { ok: true, message: "Tipo de atendimento atualizado." };
}

export async function setServiceTypeActiveAction(id: string, isActive: boolean): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role) || !uuidSchema.safeParse(id).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_types").update({ is_active: isActive }).eq("id", id).eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/configuracoes");
  return { ok: true, message: isActive ? "Opção visível para os clientes." : "Opção oculta para os clientes." };
}

export async function deleteServiceTypeAction(id: string): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role) || !uuidSchema.safeParse(id).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("service_types").delete().eq("id", id).eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/configuracoes");
  return { ok: true, message: "Tipo excluído. O histórico das chamadas antigas foi preservado." };
}
