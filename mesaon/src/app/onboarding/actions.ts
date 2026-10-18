"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_RESTAURANT_COOKIE, requireUser } from "@/lib/auth/session";
import { userMessage } from "@/lib/errors";
import { fieldErrors, formToObject, safeValues, type ActionState } from "@/lib/validation/common";
import { createRestaurantSchema } from "@/lib/validation/restaurant";
import { activeRestaurantCookieOptions } from "@/lib/auth/cookie";

export async function createRestaurantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/onboarding");
  const parsed = createRestaurantSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: safeValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { data: restaurantId, error } = await supabase.rpc("create_restaurant", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
  });

  if (error || !restaurantId) {
    const message = userMessage(error);
    if (error?.message === "SLUG_TAKEN") return { ok: false, fieldErrors: { slug: message }, values: safeValues(formData) };
    return { ok: false, message, values: safeValues(formData) };
  }

  (await cookies()).set(ACTIVE_RESTAURANT_COOKIE, restaurantId, activeRestaurantCookieOptions);
  redirect("/painel/mesas?boas-vindas=1");
}
