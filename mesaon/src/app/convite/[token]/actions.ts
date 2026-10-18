"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_RESTAURANT_COOKIE, requireUser } from "@/lib/auth/session";
import { activeRestaurantCookieOptions } from "@/lib/auth/cookie";
import { userMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/validation/common";

const TOKEN_RE = /^[a-f0-9]{48}$/;

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!TOKEN_RE.test(token)) return { ok: false, message: userMessage({ message: "INVITATION_INVALID" }) };
  await requireUser(`/convite/${token}`);

  const supabase = await createSupabaseServerClient();
  const { data: restaurantId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !restaurantId) return { ok: false, message: userMessage(error) };

  (await cookies()).set(ACTIVE_RESTAURANT_COOKIE, restaurantId, activeRestaurantCookieOptions);
  redirect("/painel/chamadas?bem-vindo=1");
}
