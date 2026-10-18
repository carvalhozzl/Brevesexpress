"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Gráficos de série única (sem legenda: o título nomeia a série).
 * Barras finas (≤ 24px) com ponta arredondada de 4px, grade discreta,
 * tooltip ao passar o mouse e tabela de dados acessível.
 */
const BAR_COLOR = "#2563EB"; // validado: contraste ≥ 3:1 sobre a superfície
const GRID = "#e3e7ef";
const AXIS_TEXT = "#55607a";

type Datum = { label: string; value: number };

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Datum }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-raised)]">
      <p className="font-semibold text-ink">{d.label}</p>
      <p className="text-muted">
        {d.value.toLocaleString("pt-BR")} {unit}
      </p>
    </div>
  );
}

function DataTable({ data, labelHeader, unit }: { data: Datum[]; labelHeader: string; unit: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">Ver dados em tabela</summary>
      <table className="mt-2 w-full text-left text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-1 font-medium">{labelHeader}</th>
            <th className="py-1 text-right font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-t border-line">
              <td className="py-1 text-ink">{d.label}</td>
              <td className="py-1 text-right tabular-nums text-ink">{d.value.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ColumnChart({ data, labelHeader, unit = "chamadas", height = 220 }: { data: Datum[]; labelHeader: string; unit?: string; height?: number }) {
  return (
    <div>
      <div style={{ height }} role="img" aria-label={`Gráfico de colunas: ${unit} por ${labelHeader.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS_TEXT, fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} width={40} />
            <Tooltip cursor={{ fill: "rgb(20 33 61 / 0.04)" }} content={<ChartTooltip unit={unit} />} />
            <Bar dataKey="value" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} labelHeader={labelHeader} unit={unit} />
    </div>
  );
}

/** Barras horizontais para categorias com nomes longos (tipos, mesas). */
export function RankedBars({ data, labelHeader, unit = "chamadas" }: { data: Datum[]; labelHeader: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <ul className="space-y-2.5" aria-label={`${unit} por ${labelHeader.toLowerCase()}`}>
        {data.map((d) => (
          <li key={d.label} className="group">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink">{d.label}</span>
              <span className="shrink-0 tabular-nums font-semibold text-ink">{d.value.toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-canvas" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: BAR_COLOR }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
