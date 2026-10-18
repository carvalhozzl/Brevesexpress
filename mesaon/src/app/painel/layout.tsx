import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { getPanelContext } from "@/lib/auth/session";
import { canManage, ROLE_LABEL } from "@/lib/roles";
import { PanelShell } from "@/components/panel/panel-shell";
import { RestaurantSwitcher } from "@/components/panel/restaurant-switcher";
import { ConfigRequired } from "@/components/panel/config-required";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel MesaOn" }, robots: { index: false } };

export default async function PanelLayout({ children }: LayoutProps<"/painel">) {
  if (!isSupabaseConfigured()) return <ConfigRequired />;
  const ctx = await getPanelContext();

  return (
    <PanelShell
      canManage={canManage(ctx.role)}
      isPlatformAdmin={ctx.profile.is_platform_admin}
      userName={ctx.profile.full_name ?? ctx.profile.email ?? "Usuário"}
      roleLabel={`${ROLE_LABEL[ctx.role]} · ${ctx.restaurant.name}`}
      switcher={<RestaurantSwitcher memberships={ctx.memberships} activeId={ctx.restaurant.id} />}
    >
      {ctx.restaurant.status === "suspended" ? (
        <Alert tone="error" title="Estabelecimento suspenso" className="mb-6">
          As mesas não estão recebendo chamadas.{ctx.restaurant.suspended_reason ? ` Motivo: ${ctx.restaurant.suspended_reason}.` : ""} Entre em
          contato com o suporte do MesaOn.
        </Alert>
      ) : null}
      {children}
    </PanelShell>
  );
}
