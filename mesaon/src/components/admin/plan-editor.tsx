"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState } from "@/lib/validation/common";
import { savePlanAction } from "@/app/admin/actions";
import type { Json } from "@/lib/supabase/database.types";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  billing_period: "monthly" | "yearly";
  max_tables: number | null;
  max_members: number | null;
  features: Json;
  highlights: string[];
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
};

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded accent-brand-600" />
      {label}
    </label>
  );
}

export function PlanEditor({ plan }: { plan: Plan | null }) {
  const [state, action, pending] = useActionState(savePlanAction, initialActionState);
  const e = state.fieldErrors ?? {};
  const features = (plan?.features ?? {}) as Record<string, unknown>;
  const p = plan?.id ?? "new";
  const price = plan?.price_cents != null ? (plan.price_cents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <Card>
      <CardHeader title={plan ? plan.name : "Novo plano"} description={plan ? `Código: ${plan.code}` : "Crie um plano adicional"} />
      <CardBody>
        <form action={action} className="space-y-4" noValidate key={plan ? p : state.ok ? state.message : "new"}>
          <input type="hidden" name="id" value={plan?.id ?? ""} />
          <FormMessage state={state} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`code-${p}`} label="Código" error={e.code}>
              <Input id={`code-${p}`} name="code" defaultValue={plan?.code} readOnly={Boolean(plan)} aria-readonly={Boolean(plan)} />
            </Field>
            <Field id={`name-${p}`} label="Nome" error={e.name}>
              <Input id={`name-${p}`} name="name" defaultValue={plan?.name} />
            </Field>
          </div>
          <Field id={`desc-${p}`} label="Descrição" error={e.description}>
            <Input id={`desc-${p}`} name="description" defaultValue={plan?.description ?? ""} maxLength={300} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field id={`price-${p}`} label="Preço (R$)" hint="Vazio = sob consulta" error={e.price}>
              <Input id={`price-${p}`} name="price" inputMode="decimal" defaultValue={price} placeholder="149,90" />
            </Field>
            <Field id={`period-${p}`} label="Cobrança">
              <Select id={`period-${p}`} name="billingPeriod" defaultValue={plan?.billing_period ?? "monthly"}>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </Select>
            </Field>
            <Field id={`tables-${p}`} label="Máx. mesas" error={e.maxTables}>
              <Input id={`tables-${p}`} name="maxTables" inputMode="numeric" defaultValue={plan?.max_tables ?? ""} />
            </Field>
            <Field id={`members-${p}`} label="Máx. equipe" error={e.maxMembers}>
              <Input id={`members-${p}`} name="maxMembers" inputMode="numeric" defaultValue={plan?.max_members ?? ""} />
            </Field>
          </div>
          <Field id={`hl-${p}`} label="Destaques (um por linha)" error={e.highlights}>
            <Textarea id={`hl-${p}`} name="highlights" defaultValue={plan?.highlights.join("\n") ?? ""} rows={4} />
          </Field>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Check name="reports" label="Relatórios" defaultChecked={features.reports === true} />
            <Check name="csvExport" label="Exportação CSV" defaultChecked={features.csv_export === true} />
            <Check name="isPublic" label="Exibir no site" defaultChecked={plan?.is_public ?? true} />
            <Check name="isActive" label="Ativo" defaultChecked={plan?.is_active ?? true} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <Field id={`order-${p}`} label="Ordem" className="w-28">
              <Input id={`order-${p}`} name="sortOrder" type="number" min={0} defaultValue={plan?.sort_order ?? 100} />
            </Field>
            <Button type="submit" loading={pending} loadingText="Salvando…">
              {plan ? "Salvar plano" : "Criar plano"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
