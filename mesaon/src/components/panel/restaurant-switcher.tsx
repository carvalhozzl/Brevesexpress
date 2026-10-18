import { Store } from "lucide-react";
import { switchRestaurantAction } from "@/app/painel/actions";
import type { Membership } from "@/lib/auth/session";
import { AutoSubmitSelect } from "./auto-submit-select";

export function RestaurantSwitcher({ memberships, activeId }: { memberships: Membership[]; activeId: string }) {
  const active = memberships.find((m) => m.restaurant.id === activeId);
  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
        <Store className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-white">{active?.restaurant.name}</span>
      </div>
    );
  }
  return (
    <form action={switchRestaurantAction}>
      <label htmlFor="restaurantId" className="mb-1 block text-xs font-medium text-white/60">
        Estabelecimento
      </label>
      <AutoSubmitSelect
        id="restaurantId"
        name="restaurantId"
        defaultValue={activeId}
        options={memberships.map((m) => ({ value: m.restaurant.id, label: m.restaurant.name }))}
      />
      <noscript>
        <button className="mt-2 text-xs text-white underline">Trocar</button>
      </noscript>
    </form>
  );
}
