import type { Metadata } from "next";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { listTables } from "@/services/tables";
import { qrSvg } from "@/lib/qr";
import { tableUrl } from "@/lib/urls";
import { tableDisplayName } from "@/lib/tables";
import { LogoMark } from "@/components/brand/logo";
import { AccessDenied } from "@/components/panel/access-denied";
import { PrintToolbar } from "./print-toolbar";

export const metadata: Metadata = { title: "Imprimir etiquetas" };

export default async function PrintPage({ searchParams }: PageProps<"/painel/mesas/imprimir">) {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return <AccessDenied />;
  const params = await searchParams;
  const ids = typeof params.ids === "string" ? new Set(params.ids.split(",").filter(Boolean)) : null;
  const size = params.tamanho === "grande" ? "grande" : "pequena";

  const tables = (await listTables(ctx.restaurant.id)).filter((t) => (ids ? ids.has(t.id) : t.is_active));
  const labels = await Promise.all(tables.map(async (t) => ({ ...t, svg: await qrSvg(tableUrl(t.public_token)) })));

  return (
    <div>
      <PrintToolbar count={labels.length} size={size} />
      {labels.length === 0 ? (
        <p className="text-muted">Nenhuma mesa ativa para imprimir.</p>
      ) : (
        <div className={size === "grande" ? "grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2" : "grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3"}>
          {labels.map((t) => (
            <article
              key={t.id}
              className="flex break-inside-avoid flex-col items-center rounded-2xl border-2 border-navy-900 bg-white p-4 text-center print:rounded-xl"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{ctx.restaurant.name}</p>
              <p className={size === "grande" ? "mt-1 text-4xl font-bold text-navy-900" : "mt-1 text-2xl font-bold text-navy-900"}>
                {tableDisplayName(t.label)}
              </p>
              <div
                className={size === "grande" ? "my-3 w-full max-w-[260px]" : "my-2 w-full max-w-[170px]"}
                // SVG gerado no servidor pela biblioteca qrcode a partir de uma URL nossa
                dangerouslySetInnerHTML={{ __html: t.svg }}
              />
              <p className="text-sm font-semibold text-navy-900">Precisa de algo? Chame pelo celular</p>
              <p className="mt-0.5 text-xs text-muted">Aponte a câmera para o código ou aproxime o celular (NFC)</p>
              <p className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                <LogoMark className="h-3.5 w-3.5" /> MesaOn
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
