import type { Metadata } from "next";
import { getPanelContext } from "@/lib/auth/session";
import { listActiveRequests, listRecentRequests } from "@/services/requests";
import { staffNames } from "@/services/team";
import { LiveCalls } from "@/components/panel/live-calls";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Chamadas" };

export default async function ChamadasPage({ searchParams }: PageProps<"/painel/chamadas">) {
  const ctx = await getPanelContext();
  const params = await searchParams;
  const [active, recent, names] = await Promise.all([
    listActiveRequests(ctx.restaurant.id),
    listRecentRequests(ctx.restaurant.id, 30),
    staffNames(ctx.restaurant.id),
  ]);
  const finished = recent.filter((r) => r.status === "completed" || r.status === "cancelled").slice(0, 15);

  return (
    <>
      {params["bem-vindo"] ? (
        <Alert tone="success" title="Bem-vindo à equipe!" className="mb-6">
          As chamadas das mesas aparecem aqui em tempo real. Mantenha esta tela aberta durante o expediente.
        </Alert>
      ) : null}
      <LiveCalls
        restaurantId={ctx.restaurant.id}
        timeZone={ctx.restaurant.timezone}
        currentUserId={ctx.user.id}
        initialActive={active}
        initialFinished={finished}
        staffNames={names}
      />
    </>
  );
}
