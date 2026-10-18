"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, fieldA11y } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon, SERVICE_ICON_MAP } from "@/components/brand/service-icon";
import { initialActionState, type ActionState } from "@/lib/validation/common";
import { SERVICE_ICONS } from "@/lib/validation/service-types";
import { BRAZIL_TIMEZONES } from "@/lib/timezones";
import {
  changePasswordAction,
  createServiceTypeAction,
  deleteServiceTypeAction,
  setServiceTypeActiveAction,
  updateProfileAction,
  updateRestaurantAction,
  updateServiceTypeAction,
} from "@/app/painel/configuracoes/actions";

type ServiceType = { id: string; name: string; icon: string; sort_order: number; is_active: boolean };

function IconSelect({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue}>
      {SERVICE_ICONS.map((key) => (
        <option key={key} value={key}>
          {SERVICE_ICON_MAP[key].label}
        </option>
      ))}
    </Select>
  );
}

export function ServiceTypesManager({ types }: { types: ServiceType[] }) {
  const [createState, createAction, creating] = useActionState(createServiceTypeAction, initialActionState);
  const [flash, setFlash] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const e = createState.fieldErrors ?? {};

  const run = (id: string, fn: () => Promise<ActionState>) => {
    setBusy(id);
    start(async () => {
      setFlash(await fn());
      setBusy(null);
      setConfirmDelete(null);
    });
  };

  return (
    <Card>
      <CardHeader title="Tipos de atendimento" description="Os botões que o cliente vê na mesa. Reordene pelo número de ordem (menor aparece primeiro)." />
      <CardBody className="space-y-4">
        {flash?.message ? <Alert tone={flash.ok ? "success" : "error"}>{flash.message}</Alert> : null}
        {types.length === 0 ? <Alert tone="warning">Nenhum tipo cadastrado — os clientes não verão opções na mesa.</Alert> : null}
        <ul className="space-y-3">
          {types.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-3">
              <ServiceTypeRow type={t} />
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                {t.is_active ? <Badge tone="success">Visível</Badge> : <Badge>Oculto</Badge>}
                <Button size="sm" variant="ghost" loading={pending && busy === `a:${t.id}`} onClick={() => run(`a:${t.id}`, () => setServiceTypeActiveAction(t.id, !t.is_active))}>
                  {t.is_active ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  {t.is_active ? "Ocultar" : "Mostrar"}
                </Button>
                {confirmDelete === t.id ? (
                  <>
                    <Button size="sm" variant="danger" loading={pending && busy === `d:${t.id}`} onClick={() => run(`d:${t.id}`, () => deleteServiceTypeAction(t.id))}>
                      Confirmar exclusão
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Voltar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger-ghost" onClick={() => setConfirmDelete(t.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <form action={createAction} className="rounded-xl border border-dashed border-line p-3" noValidate key={createState.ok ? createState.message : "new"}>
          <p className="mb-3 text-sm font-semibold text-ink">Adicionar tipo</p>
          <FormMessage state={createState} />
          <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_150px_84px_auto] sm:items-end">
            <Field id="new-name" label="Nome" error={e.name}>
              <Input {...fieldA11y("new-name", e.name)} name="name" defaultValue={createState.ok ? "" : createState.values?.name} placeholder="Ex.: Trazer gelo" maxLength={40} />
            </Field>
            <Field id="new-icon" label="Ícone">
              <IconSelect id="new-icon" name="icon" defaultValue={createState.values?.icon ?? "help"} />
            </Field>
            <Field id="new-order" label="Ordem" error={e.sortOrder}>
              <Input id="new-order" name="sortOrder" type="number" min={0} max={9999} defaultValue={createState.values?.sortOrder ?? String((types.at(-1)?.sort_order ?? 0) + 10)} />
            </Field>
            <Button type="submit" loading={creating} loadingText="Adicionando…">
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ServiceTypeRow({ type }: { type: ServiceType }) {
  const [state, action, pending] = useActionState(updateServiceTypeAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[auto_minmax(10rem,1fr)_150px_84px_auto] sm:items-end" noValidate>
      <input type="hidden" name="id" value={type.id} />
      <span className="hidden h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 sm:grid" aria-hidden="true">
        <ServiceIcon icon={type.icon} className="h-5 w-5" />
      </span>
      <Field id={`n-${type.id}`} label="Nome" error={e.name}>
        <Input id={`n-${type.id}`} name="name" defaultValue={type.name} maxLength={40} aria-invalid={e.name ? true : undefined} />
      </Field>
      <Field id={`i-${type.id}`} label="Ícone">
        <IconSelect id={`i-${type.id}`} name="icon" defaultValue={type.icon} />
      </Field>
      <Field id={`o-${type.id}`} label="Ordem">
        <Input id={`o-${type.id}`} name="sortOrder" type="number" min={0} max={9999} defaultValue={type.sort_order} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} loadingText="Salvando">
        Salvar
      </Button>
      {state.message ? (
        <p className={`text-xs sm:col-span-5 ${state.ok ? "text-success-700" : "text-danger-700"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RestaurantForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, action, pending] = useActionState(updateRestaurantAction, initialActionState);
  const e = state.fieldErrors ?? {};
  const known = BRAZIL_TIMEZONES.some((t) => t.value === timezone);
  return (
    <Card>
      <CardHeader title="Estabelecimento" />
      <CardBody>
        <form action={action} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <Field id="r-name" label="Nome exibido para os clientes" error={e.name}>
            <Input id="r-name" name="name" defaultValue={name} maxLength={80} aria-invalid={e.name ? true : undefined} />
          </Field>
          <Field id="r-tz" label="Fuso horário" hint="Usado no histórico, nos relatórios e no horário mostrado aos clientes." error={e.timezone}>
            <Select id="r-tz" name="timezone" defaultValue={timezone}>
              {!known ? <option value={timezone}>{timezone}</option> : null}
              {BRAZIL_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={pending} loadingText="Salvando…">
            Salvar alterações
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function AccountForms({ fullName, email }: { fullName: string; email: string }) {
  const [profileState, profileAction, savingProfile] = useActionState(updateProfileAction, initialActionState);
  const [pwState, pwAction, savingPw] = useActionState(changePasswordAction, initialActionState);
  return (
    <Card>
      <CardHeader title="Minha conta" description={email} />
      <CardBody className="space-y-6">
        <form action={profileAction} className="space-y-3" noValidate>
          <FormMessage state={profileState} />
          <Field id="fullName" label="Seu nome" error={profileState.fieldErrors?.fullName}>
            <Input {...fieldA11y("fullName", profileState.fieldErrors?.fullName)} defaultValue={fullName} maxLength={100} autoComplete="name" />
          </Field>
          <Button type="submit" variant="secondary" loading={savingProfile} loadingText="Salvando…">
            Salvar nome
          </Button>
        </form>
        <form action={pwAction} className="space-y-3 border-t border-line pt-6" noValidate key={pwState.ok ? "done" : "pw"}>
          <p className="font-semibold text-ink">Alterar senha</p>
          <FormMessage state={pwState} />
          <Field id="password" label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números." error={pwState.fieldErrors?.password}>
            <PasswordInput {...fieldA11y("password", pwState.fieldErrors?.password, true)} autoComplete="new-password" />
          </Field>
          <Field id="confirmPassword" label="Confirme a nova senha" error={pwState.fieldErrors?.confirmPassword}>
            <PasswordInput {...fieldA11y("confirmPassword", pwState.fieldErrors?.confirmPassword)} autoComplete="new-password" />
          </Field>
          <Button type="submit" variant="secondary" loading={savingPw} loadingText="Salvando…">
            Alterar senha
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
