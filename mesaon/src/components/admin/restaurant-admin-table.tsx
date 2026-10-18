"use client";

import { useActionState, useState } from "react";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { EmptyState } from "@/components/ui/empty-state";
import { initialActionState } from "@/lib/validation/common";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";
import { setRestaurantStatusAction, updateSubscriptionAction } from "@/app/admin/actions";

type Usage = Database["public"]["Functions"]["admin_restaurant_usage"]["Returns"][number];
type Plan = { id: string; name: string; is_active: boolean };

const SUB_LABEL = { trialing: "Em teste", active: "Ativa", past_due: "Pagamento pendente", canceled: "Cancelada" } as const;

export function RestaurantAdminTable({ restaurants, plans }: { restaurants: Usage[]; plans: Plan[] }) {
  const [selected, setSelected] = useState<Usage | null>(null);
  const [query, setQuery] = useState("");
  const filtered = restaurants.filter((r) => `${r.name} ${r.slug}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <div className="mb-3 max-w-sm">
        <label htmlFor="busca" className="sr-only">
          Buscar restaurante
        </label>
        <Input id="busca" placeholder="Buscar por nome ou identificador" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Settings2} title="Nenhum restaurante encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Restaurante</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Plano</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Mesas</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Equipe</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Chamadas 30d</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Criado em</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{r.name}</p>
                      <p className="font-mono text-xs text-muted">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">{r.status === "active" ? <Badge tone="success">Ativo</Badge> : <Badge tone="danger">Suspenso</Badge>}</td>
                    <td className="px-4 py-3 text-ink">
                      {r.plan_name ?? "—"}
                      {r.subscription_status ? <span className="block text-xs text-muted">{SUB_LABEL[r.subscription_status]}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.tables_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.members_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.requests_30d}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ManageDialog key={selected?.id ?? "none"} restaurant={selected} plans={plans} onClose={() => setSelected(null)} />
    </>
  );
}

function override(value: unknown): "" | "true" | "false" {
  return value === true ? "true" : value === false ? "false" : "";
}

function ManageDialog({ restaurant, plans, onClose }: { restaurant: Usage | null; plans: Plan[]; onClose: () => void }) {
  const [statusState, statusAction, savingStatus] = useActionState(setRestaurantStatusAction, initialActionState);
  const [subState, subAction, savingSub] = useActionState(updateSubscriptionAction, initialActionState);
  if (!restaurant) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const overrides = (restaurant.feature_overrides ?? {}) as Record<string, unknown>;
  const suspended = restaurant.status === "suspended";

  return (
    <Dialog open onClose={onClose} title={restaurant.name} description={`Identificador: ${restaurant.slug}`}>
      <div className="space-y-6">
        <form action={subAction} className="space-y-3">
          <input type="hidden" name="restaurantId" value={restaurant.id} />
          <p className="font-semibold text-ink">Plano e limites</p>
          <FormMessage state={subState} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="planId" label="Plano">
              <Select id="planId" name="planId" defaultValue={restaurant.plan_id ?? plans[0]?.id}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_active ? "" : " (inativo)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="subscriptionStatus" label="Situação da assinatura">
              <Select id="subscriptionStatus" name="subscriptionStatus" defaultValue={restaurant.subscription_status ?? "active"}>
                {Object.entries(SUB_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="reports" label="Relatórios">
              <Select id="reports" name="reports" defaultValue={override(overrides.reports)}>
                <option value="">Conforme o plano</option>
                <option value="true">Liberar</option>
                <option value="false">Bloquear</option>
              </Select>
            </Field>
            <Field id="csvExport" label="Exportação CSV">
              <Select id="csvExport" name="csvExport" defaultValue={override(overrides.csv_export)}>
                <option value="">Conforme o plano</option>
                <option value="true">Liberar</option>
                <option value="false">Bloquear</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" loading={savingSub} loadingText="Salvando…">
            Salvar plano
          </Button>
        </form>

        <form action={statusAction} className="space-y-3 border-t border-line pt-5">
          <input type="hidden" name="restaurantId" value={restaurant.id} />
          <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
          <p className="font-semibold text-ink">{suspended ? "Reativar restaurante" : "Suspender restaurante"}</p>
          <p className="text-sm text-muted">
            {suspended
              ? "As mesas voltam a aceitar chamadas imediatamente."
              : "As mesas deixam de aceitar chamadas. A equipe continua acessando o painel e o histórico."}
          </p>
          <FormMessage state={statusState} />
          {!suspended ? (
            <Field id="reason" label="Motivo (visível para o restaurante)">
              <Input id="reason" name="reason" maxLength={300} />
            </Field>
          ) : null}
          <Button type="submit" variant={suspended ? "success" : "danger"} loading={savingStatus} loadingText="Salvando…">
            {suspended ? "Reativar" : "Suspender"}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
