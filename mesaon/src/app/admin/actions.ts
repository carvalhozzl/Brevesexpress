"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { userMessage } from "@/lib/errors";
import { fieldErrors, formToObject, type ActionState } from "@/lib/validation/common";
import { planSchema } from "@/lib/validation/plans";

const FORBIDDEN: ActionState = { ok: false, message: userMessage({ message: "FORBIDDEN" }) };

async function admin() {
  const { allowed } = await requirePlatformAdmin();
  return allowed;
}

const statusSchema = z.object({
  restaurantId: z.uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(300).optional().default(""),
});

export async function setRestaurantStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await admin())) return FORBIDDEN;
  const parsed = statusSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_restaurant_status", {
    p_restaurant_id: parsed.data.restaurantId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/admin");
  return { ok: true, message: parsed.data.status === "suspended" ? "Restaurante suspenso." : "Restaurante reativado." };
}

const subscriptionSchema = z.object({
  restaurantId: z.uuid(),
  planId: z.uuid(),
  subscriptionStatus: z.enum(["trialing", "active", "past_due", "canceled"]),
  reports: z.enum(["", "true", "false"]).optional().default(""),
  csvExport: z.enum(["", "true", "false"]).optional().default(""),
});

export async function updateSubscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await admin())) return FORBIDDEN;
  const parsed = subscriptionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_restaurant_id: parsed.data.restaurantId,
    p_plan_id: parsed.data.planId,
    p_status: parsed.data.subscriptionStatus,
  });
  if (error) return { ok: false, message: userMessage(error) };

  const overrides: Record<string, boolean> = {};
  if (parsed.data.reports) overrides.reports = parsed.data.reports === "true";
  if (parsed.data.csvExport) overrides.csv_export = parsed.data.csvExport === "true";
  const { error: featuresError } = await supabase.rpc("admin_set_feature_overrides", {
    p_restaurant_id: parsed.data.restaurantId,
    p_overrides: overrides,
  });
  if (featuresError) return { ok: false, message: userMessage(featuresError) };

  revalidatePath("/admin");
  return { ok: true, message: "Plano e funcionalidades atualizados." };
}

export async function savePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await admin())) return FORBIDDEN;
  const parsed = planSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const row = {
    name: d.name,
    description: d.description || null,
    price_cents: d.price,
    billing_period: d.billingPeriod,
    max_tables: d.maxTables,
    max_members: d.maxMembers,
    highlights: d.highlights,
    features: { reports: Boolean(d.reports), csv_export: Boolean(d.csvExport) },
    is_public: Boolean(d.isPublic),
    is_active: Boolean(d.isActive),
    sort_order: d.sortOrder,
  };
  const supabase = await createSupabaseServerClient();
  const { error } = d.id
    ? await supabase.from("subscription_plans").update(row).eq("id", d.id)
    : await supabase.from("subscription_plans").insert({ ...row, code: d.code });
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { code: "Já existe um plano com este código." } };
    return { ok: false, message: userMessage(error) };
  }
  revalidatePath("/admin/planos");
  revalidatePath("/");
  return { ok: true, message: d.id ? "Plano atualizado." : "Plano criado." };
}
