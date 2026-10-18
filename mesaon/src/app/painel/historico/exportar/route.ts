import { NextResponse, type NextRequest } from "next/server";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { historyFiltersSchema } from "@/lib/validation/requests";
import { getFeatures, listHistory } from "@/services/requests";
import { listMembers } from "@/services/team";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/requests";
import { logServerError } from "@/lib/errors";

/** Exporta o histórico filtrado em CSV (proprietário/gerente; plano com exportação). */
export async function GET(request: NextRequest) {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return new NextResponse("Sem permissão.", { status: 403 });

  try {
    const features = await getFeatures(ctx.restaurant.id);
    if (!features.csv_export) return new NextResponse("Exportação não disponível no seu plano.", { status: 403 });

    const filters = historyFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const tz = ctx.restaurant.timezone;
    const [{ rows, range }, members] = await Promise.all([
      listHistory(ctx.restaurant.id, tz, filters, { all: true }),
      listMembers(ctx.restaurant.id),
    ]);
    const names = Object.fromEntries(members.map((m) => [m.userId, m.name ?? m.email ?? ""]));
    const secs = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);

    const csv = toCsv(rows, [
      { header: "Data/hora", value: (r) => formatDateTime(r.created_at, tz) },
      { header: "Mesa", value: (r) => r.table_label },
      { header: "Tipo", value: (r) => r.service_type_name },
      { header: "Status", value: (r) => STATUS_LABEL[r.status] },
      { header: "Responsável", value: (r) => (r.assigned_to ? (names[r.assigned_to] ?? "") : "") },
      { header: "Recebida em", value: (r) => (r.received_at ? formatDateTime(r.received_at, tz) : "") },
      { header: "Concluída em", value: (r) => (r.completed_at ? formatDateTime(r.completed_at, tz) : "") },
      { header: "Segundos até aceite", value: (r) => secs(r.created_at, r.received_at) },
      { header: "Segundos até conclusão", value: (r) => secs(r.created_at, r.completed_at) },
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mesaon-historico-${range.from}-a-${range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("history.export", error);
    return new NextResponse("Não foi possível gerar o arquivo.", { status: 500 });
  }
}
