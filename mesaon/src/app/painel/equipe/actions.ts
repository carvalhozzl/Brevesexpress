"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { siteUrl } from "@/lib/env";
import { userMessage } from "@/lib/errors";
import { fieldErrors, formToObject, uuidSchema, type ActionState } from "@/lib/validation/common";
import { inviteSchema, updateMemberSchema } from "@/lib/validation/team";

const FORBIDDEN: ActionState = { ok: false, message: userMessage({ message: "FORBIDDEN" }) };

export async function inviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return FORBIDDEN;
  const parsed = inviteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: formToObject(formData) };

  const supabase = await createSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_restaurant_id: ctx.restaurant.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return { ok: false, message: userMessage(error), values: formToObject(formData) };

  revalidatePath("/painel/equipe");
  return {
    ok: true,
    message: `Convite criado para ${parsed.data.email}. Copie o link abaixo e envie para a pessoa (WhatsApp, e-mail etc.). Ele vale por 7 dias e só aparece agora.`,
    data: { link: `${siteUrl()}/convite/${token}` },
  };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role) || !uuidSchema.safeParse(invitationId).success) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/equipe");
  return { ok: true, message: "Convite cancelado." };
}

export async function updateMemberAction(input: { memberId: string; role?: string; isActive?: "true" | "false" }): Promise<ActionState> {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return FORBIDDEN;
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role ?? null,
    p_is_active: parsed.data.isActive ?? null,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/painel/equipe");
  return { ok: true, message: "Acesso atualizado." };
}
