"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, MailPlus, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, fieldA11y } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState, type ActionState } from "@/lib/validation/common";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import type { MemberRole } from "@/lib/supabase/database.types";
import type { TeamMember } from "@/services/team";
import { inviteAction, revokeInvitationAction, updateMemberAction } from "@/app/painel/equipe/actions";

type Invitation = { id: string; email: string; role: MemberRole; expires_at: string };

export function TeamManager({
  members,
  invitations,
  callerRole,
  currentUserId,
  maxMembers,
  timeZone,
}: {
  members: TeamMember[];
  invitations: Invitation[];
  callerRole: MemberRole;
  currentUserId: string;
  maxMembers: number | null;
  timeZone: string;
}) {
  const [flash, setFlash] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const isOwner = callerRole === "owner";
  const activeCount = members.filter((m) => m.isActive).length;
  const used = activeCount + invitations.length;

  const run = (id: string, fn: () => Promise<ActionState>) => {
    setBusy(id);
    start(async () => {
      setFlash(await fn());
      setBusy(null);
    });
  };

  const canEdit = (m: TeamMember) => m.userId !== currentUserId && (isOwner || m.role === "attendant");

  return (
    <div className="space-y-6">
      {flash?.message ? (
        <Alert tone={flash.ok ? "success" : "error"} action={<Button size="sm" variant="ghost" onClick={() => setFlash(null)}>Fechar</Button>}>
          {flash.message}
        </Alert>
      ) : null}

      <InviteCard isOwner={isOwner} disabled={maxMembers != null && used >= maxMembers} />

      <Card>
        <CardHeader title={`Pessoas (${activeCount}${maxMembers != null ? ` de ${maxMembers}` : ""} ativas)`} description="Convites pendentes também contam no limite do plano." />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700" aria-hidden="true">
                {(m.name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {m.name ?? "Sem nome"}
                  {m.userId === currentUserId ? <Badge tone="info">Você</Badge> : null}
                  {!m.isActive ? <Badge tone="neutral">Acesso desativado</Badge> : null}
                </p>
                <p className="truncate text-sm text-muted">{m.email}</p>
              </div>
              {canEdit(m) && isOwner ? (
                <div>
                  <label htmlFor={`role-${m.id}`} className="sr-only">
                    Função de {m.name ?? m.email}
                  </label>
                  <Select
                    id={`role-${m.id}`}
                    className="h-9 w-40 text-sm"
                    defaultValue={m.role}
                    disabled={pending && busy === m.id}
                    onChange={(e) => run(m.id, () => updateMemberAction({ memberId: m.id, role: e.target.value }))}
                  >
                    {(["owner", "manager", "attendant"] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <Badge tone={m.role === "owner" ? "brand" : m.role === "manager" ? "info" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
              )}
              {canEdit(m) ? (
                <Button
                  size="sm"
                  variant={m.isActive ? "danger-ghost" : "secondary"}
                  loading={pending && busy === `${m.id}:active`}
                  onClick={() => run(`${m.id}:active`, () => updateMemberAction({ memberId: m.id, isActive: m.isActive ? "false" : "true" }))}
                >
                  {m.isActive ? <UserX className="h-4 w-4" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                  {m.isActive ? "Desativar acesso" : "Reativar"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Convites pendentes" />
        {invitations.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">Nenhum convite pendente.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{i.email}</p>
                  <p className="text-xs text-muted">
                    {ROLE_LABEL[i.role]} · expira em {formatDateTime(i.expires_at, timeZone)}
                  </p>
                </div>
                {isOwner || i.role === "attendant" ? (
                  <Button size="sm" variant="danger-ghost" loading={pending && busy === i.id} onClick={() => run(i.id, () => revokeInvitationAction(i.id))}>
                    Cancelar convite
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Funções e permissões" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-3">
            {(["owner", "manager", "attendant"] as const).map((r) => (
              <div key={r}>
                <dt className="font-semibold text-ink">{ROLE_LABEL[r]}</dt>
                <dd className="mt-1 text-sm text-muted">{ROLE_DESCRIPTION[r]}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function InviteCard({ isOwner, disabled }: { isOwner: boolean; disabled: boolean }) {
  const [state, action, pending] = useActionState(inviteAction, initialActionState);
  const [copied, setCopied] = useState(false);
  const e = state.fieldErrors ?? {};
  const link = state.ok ? (state.data?.link as string | undefined) : undefined;

  return (
    <Card>
      <CardHeader title="Convidar pessoa" description="A pessoa cria a conta (ou entra) com o mesmo e-mail e aceita o convite." />
      <CardBody>
        {disabled ? (
          <Alert tone="warning" className="mb-4">
            O limite de pessoas do plano foi atingido. Desative acessos sem uso ou cancele convites pendentes.
          </Alert>
        ) : null}
        <form action={action} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end" noValidate key={link ?? "invite"}>
          <Field id="email" label="E-mail" error={e.email}>
            <Input {...fieldA11y("email", e.email)} type="email" defaultValue={state.ok ? "" : state.values?.email} disabled={disabled} required />
          </Field>
          <Field id="role" label="Função" error={e.role}>
            <Select {...fieldA11y("role", e.role)} defaultValue={state.values?.role ?? "attendant"} disabled={disabled}>
              <option value="attendant">{ROLE_LABEL.attendant}</option>
              {isOwner ? <option value="manager">{ROLE_LABEL.manager}</option> : null}
            </Select>
          </Field>
          <Button type="submit" loading={pending} disabled={disabled} loadingText="Criando…" className="sm:mb-0">
            <MailPlus className="h-4 w-4" aria-hidden="true" /> Gerar convite
          </Button>
        </form>
        <div className="mt-4 space-y-3">
          <FormMessage state={state} />
          {link ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all text-xs text-ink">{link}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
