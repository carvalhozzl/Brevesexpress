import type { Metadata } from "next";
import { AlertTriangle, Ban, QrCode, Store } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { isServerConfigured } from "@/lib/env.server";
import { getPublicTable, isValidTableToken, type PublicTable } from "@/services/public-table";
import { logServerError } from "@/lib/errors";
import { TableClient } from "@/components/customer/table-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atendimento na mesa",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-canvas px-4 pb-8 pt-5">
      {children}
      <p className="mt-auto flex items-center justify-center gap-1.5 pt-10 text-xs text-muted">
        <LogoMark className="h-4 w-4" /> Atendimento por <span className="font-semibold text-ink">MesaOn</span>
      </p>
    </main>
  );
}

function Problem({ icon: Icon, title, text }: { icon: typeof QrCode; title: string; text: string }) {
  return (
    <Shell>
      <div className="mt-16 rounded-3xl border border-line bg-white p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning-50 text-warning-700">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-muted">{text}</p>
      </div>
    </Shell>
  );
}

export default async function TablePage({ params }: PageProps<"/m/[token]">) {
  const { token } = await params;

  if (!isSupabaseConfigured() || !isServerConfigured()) {
    return <Problem icon={AlertTriangle} title="Serviço em configuração" text="O atendimento digital ainda não foi configurado. Chame um atendente." />;
  }
  if (!isValidTableToken(token)) {
    return <Problem icon={QrCode} title="QR Code inválido" text="Não reconhecemos este código. Peça ajuda a um atendente ou leia o QR Code da mesa novamente." />;
  }

  let table: PublicTable | null = null;
  try {
    table = await getPublicTable(token);
  } catch (error) {
    logServerError("m.page", error);
    return <Problem icon={AlertTriangle} title="Não foi possível conectar" text="Tivemos um problema para falar com o servidor. Atualize a página em alguns segundos." />;
  }

  if (!table) {
    return <Problem icon={QrCode} title="QR Code inválido ou desativado" text="Esta mesa não foi encontrada. O código pode ter sido substituído. Chame um atendente." />;
  }
  if (!table.restaurant.is_active) {
    return <Problem icon={Store} title={table.restaurant.name} text="O atendimento digital está temporariamente indisponível. Chame um atendente." />;
  }
  if (!table.table.is_active) {
    return <Problem icon={Ban} title={`Mesa ${table.table.label} desativada`} text="Esta mesa não está recebendo chamadas pelo celular no momento. Chame um atendente." />;
  }

  return (
    <Shell>
      <TableClient token={token} initial={table} />
    </Shell>
  );
}
