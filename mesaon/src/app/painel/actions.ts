"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_RESTAURANT_COOKIE, getMemberships } from "@/lib/auth/session";
import { activeRestaurantCookieOptions } from "@/lib/auth/cookie";
import { uuidSchema } from "@/lib/validation/common";

/** Troca o restaurante ativo — só aceita restaurantes dos quais o usuário é membro ativo. */
export async function switchRestaurantAction(formData: FormData) {
  const parsed = uuidSchema.safeParse(formData.get("restaurantId"));
  if (!parsed.success) return;
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.restaurant.id === parsed.data)) return;
  (await cookies()).set(ACTIVE_RESTAURANT_COOKIE, parsed.data, activeRestaurantCookieOptions);
  revalidatePath("/painel", "layout");
}
