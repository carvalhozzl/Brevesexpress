import Link from "next/link";
import { Filter } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ALL_STATUSES, STATUS_LABEL } from "@/lib/requests";
import { tableDisplayName } from "@/lib/tables";
import type { HistoryFilters as Filters } from "@/lib/validation/requests";

export function HistoryFilters({
  action,
  filters,
  range,
  tables,
  types,
  staff,
  showStatus = true,
}: {
  action: string;
  filters: Filters;
  range: { from: string; to: string };
  tables: { id: string; label: string }[];
  types: { id: string; name: string }[];
  staff: { userId: string; name: string }[];
  showStatus?: boolean;
}) {
  return (
    <form method="get" action={action} className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
      <div>
        <Label htmlFor="f-from">De</Label>
        <Input id="f-from" name="from" type="date" defaultValue={range.from} />
      </div>
      <div>
        <Label htmlFor="f-to">Até</Label>
        <Input id="f-to" name="to" type="date" defaultValue={range.to} />
      </div>
      <div>
        <Label htmlFor="f-table">Mesa</Label>
        <Select id="f-table" name="table" defaultValue={filters.table ?? ""}>
          <option value="">Todas</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {tableDisplayName(t.label)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="f-type">Tipo</Label>
        <Select id="f-type" name="type" defaultValue={filters.type ?? ""}>
          <option value="">Todos</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      {showStatus ? (
        <div>
          <Label htmlFor="f-status">Status</Label>
          <Select id="f-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="f-staff">Responsável</Label>
        <Select id="f-staff" name="staff" defaultValue={filters.staff ?? ""}>
          <option value="">Todos</option>
          {staff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" className="flex-1 lg:flex-none">
          <Filter className="h-4 w-4" aria-hidden="true" /> Filtrar
        </Button>
        <Link href={action} className={buttonClasses("ghost", "md")}>
          Limpar
        </Link>
      </div>
    </form>
  );
}

export function filtersToQuery(filters: Filters, range: { from: string; to: string }, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  p.set("from", range.from);
  p.set("to", range.to);
  if (filters.table) p.set("table", filters.table);
  if (filters.type) p.set("type", filters.type);
  if (filters.status) p.set("status", filters.status);
  if (filters.staff) p.set("staff", filters.staff);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}
