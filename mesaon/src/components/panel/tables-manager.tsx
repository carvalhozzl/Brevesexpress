"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Copy, Download, ExternalLink, Nfc, Pencil, Plus, Power, Printer, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, fieldA11y } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { initialActionState, type ActionState } from "@/lib/validation/common";
import { qrFileName, qrPngDataUrl, qrSvg } from "@/lib/qr";
import { tableDisplayName } from "@/lib/tables";
import { formatDateTime } from "@/lib/format";
import {
  createTableAction,
  createTablesBulkAction,
  deleteTableAction,
  markNfcLinkedAction,
  regenerateTokenAction,
  setTableActiveAction,
  updateTableAction,
} from "@/app/painel/mesas/actions";

export type ManagedTable = {
  id: string;
  label: string;
  public_token: string;
  is_active: boolean;
  nfc_tag_id: string | null;
  nfc_linked_at: string | null;
  url: string;
};

export function TablesManager({ tables, limit, timeZone }: { tables: ManagedTable[]; limit: number | null; timeZone: string }) {
  const [qrFor, setQrFor] = useState<ManagedTable | null>(null);
  const [editFor, setEditFor] = useState<ManagedTable | null>(null);
  const [flash, setFlash] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "delete" | "regenerate" } | null>(null);

  const run = (id: string, fn: () => Promise<ActionState>) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await fn();
      setFlash(result);
      setBusyId(null);
      setConfirm(null);
    });
  };

  const atLimit = limit != null && tables.length >= limit;
  const activeCount = tables.filter((t) => t.is_active).length;

  return (
    <div className="space-y-6">
      {flash?.message ? (
        <Alert tone={flash.ok ? "success" : "error"} action={<Button size="sm" variant="ghost" onClick={() => setFlash(null)}>Fechar</Button>}>
          {flash.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateTableCard disabled={atLimit} />
        <BulkCreateCard disabled={atLimit} />
      </div>
      {atLimit ? (
        <Alert tone="warning" title="Limite do plano atingido">
          Seu plano permite até {limit} mesas. Desative ou exclua mesas sem uso, ou fale com a equipe do MesaOn para mudar de plano.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`Mesas (${tables.length}${limit != null ? ` de ${limit}` : ""})`}
          description={`${activeCount} ativa(s). Cada mesa tem um QR Code exclusivo e um link que pode ser gravado em uma tag NFC.`}
          action={
            tables.length > 0 ? (
              <Link href="/painel/mesas/imprimir" className={buttonClasses("secondary", "sm")} target="_blank">
                <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir etiquetas
              </Link>
            ) : undefined
          }
        />
        {tables.length === 0 ? (
          <EmptyState icon={QrCode} title="Nenhuma mesa cadastrada" description="Crie suas mesas acima. Em seguida, imprima os QR Codes e coloque-os nas mesas." />
        ) : (
          <ul className="divide-y divide-line">
            {tables.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className={`grid h-11 min-w-11 place-items-center rounded-xl px-2 text-sm font-bold ${t.is_active ? "bg-navy-900 text-white" : "bg-canvas text-muted"}`} aria-hidden="true">
                  {t.label.length <= 4 ? t.label : t.label.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {tableDisplayName(t.label)}
                    {t.is_active ? <Badge tone="success">Ativa</Badge> : <Badge tone="neutral">Desativada</Badge>}
                    {t.nfc_linked_at ? (
                      <Badge tone="info">
                        <Nfc className="h-3 w-3" aria-hidden="true" /> NFC
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted" title={t.url}>
                    {t.url}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setQrFor(t)}>
                    <QrCode className="h-4 w-4" aria-hidden="true" /> QR Code / NFC
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditFor(t)} aria-label={`Editar ${tableDisplayName(t.label)}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(t.id, () => setTableActiveAction(t.id, !t.is_active))}
                    loading={pending && busyId === t.id && !confirm}
                    aria-label={t.is_active ? `Desativar ${tableDisplayName(t.label)}` : `Ativar ${tableDisplayName(t.label)}`}
                    title={t.is_active ? "Desativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {confirm?.id === t.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={pending && busyId === t.id}
                        onClick={() => run(t.id, () => (confirm.kind === "delete" ? deleteTableAction(t.id) : regenerateTokenAction(t.id)))}
                      >
                        {confirm.kind === "delete" ? "Confirmar exclusão" : "Confirmar novo código"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Voltar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ id: t.id, kind: "regenerate" })} title="Gerar novo código" aria-label={`Gerar novo código para ${tableDisplayName(t.label)}`}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setConfirm({ id: t.id, kind: "delete" })} title="Excluir" aria-label={`Excluir ${tableDisplayName(t.label)}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <QrDialog key={qrFor?.id ?? "none"} table={qrFor} onClose={() => setQrFor(null)} timeZone={timeZone} onMessage={setFlash} />
      <EditDialog key={editFor?.id ?? "none"} table={editFor} onClose={() => setEditFor(null)} onSaved={(s) => { setFlash(s); setEditFor(null); }} />
    </div>
  );
}

function CreateTableCard({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(createTableAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Nova mesa" description="Número ou nome livre, ex.: 12, Varanda 3, Balcão." />
      <CardBody>
        <form action={action} className="space-y-3" noValidate key={state.ok ? state.message : "form"}>
          {!state.fieldErrors ? <FormMessage state={state} /> : null}
          <Field id="label" label="Identificação da mesa" error={e.label}>
            <Input {...fieldA11y("label", e.label)} defaultValue={state.ok ? "" : state.values?.label} maxLength={30} disabled={disabled} required />
          </Field>
          <Button type="submit" loading={pending} disabled={disabled} loadingText="Criando…">
            <Plus className="h-4 w-4" aria-hidden="true" /> Criar mesa
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function BulkCreateCard({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(createTablesBulkAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader title="Criar várias mesas" description="Gera uma sequência numérica de uma vez (máx. 200)." />
      <CardBody>
        <form action={action} className="space-y-3" noValidate>
          <FormMessage state={state} />
          <div className="grid grid-cols-3 gap-3">
            <Field id="from" label="De" error={e.from}>
              <Input {...fieldA11y("from", e.from)} type="number" min={1} max={9999} defaultValue={state.values?.from ?? "1"} disabled={disabled} inputMode="numeric" />
            </Field>
            <Field id="to" label="Até" error={e.to}>
              <Input {...fieldA11y("to", e.to)} type="number" min={1} max={9999} defaultValue={state.values?.to ?? "10"} disabled={disabled} inputMode="numeric" />
            </Field>
            <Field id="prefix" label="Prefixo (opcional)" error={e.prefix}>
              <Input {...fieldA11y("prefix", e.prefix)} placeholder="Varanda" defaultValue={state.values?.prefix} maxLength={20} disabled={disabled} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" loading={pending} disabled={disabled} loadingText="Criando…">
            <Plus className="h-4 w-4" aria-hidden="true" /> Criar sequência
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function EditDialog({ table, onClose, onSaved }: { table: ManagedTable | null; onClose: () => void; onSaved: (s: ActionState) => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await updateTableAction(prev, fd);
    if (result.ok) onSaved(result);
    return result;
  }, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <Dialog open={Boolean(table)} onClose={onClose} title={table ? `Editar ${tableDisplayName(table.label)}` : "Editar mesa"}>
      {table ? (
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={table.id} />
          {!state.ok ? <FormMessage state={state} /> : null}
          <Field id="edit-label" label="Identificação da mesa" error={e.label}>
            <Input id="edit-label" name="label" defaultValue={table.label} maxLength={30} aria-invalid={e.label ? true : undefined} required />
          </Field>
          <Field id="edit-nfc" label="Identificador da tag NFC (opcional)" hint="Anote o número de série ou uma etiqueta da tag para controle interno." error={e.nfcTagId}>
            <Input id="edit-nfc" name="nfcTagId" defaultValue={table.nfc_tag_id ?? ""} maxLength={64} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} loadingText="Salvando…">
              Salvar
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

type NdefWriter = { write: (message: { records: { recordType: string; data: string }[] }) => Promise<void> };

function QrDialog({
  table,
  onClose,
  timeZone,
  onMessage,
}: {
  table: ManagedTable | null;
  onClose: () => void;
  timeZone: string;
  onMessage: (s: ActionState) => void;
}) {
  // o componente é remontado (key) a cada mesa, então o estado começa limpo
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nfcState, setNfcState] = useState<"idle" | "waiting" | "done" | "error" | "unsupported">(() =>
    typeof window !== "undefined" && "NDEFReader" in window ? "idle" : "unsupported",
  );
  const [nfcError, setNfcError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (table) void qrPngDataUrl(table.url, 720).then((url) => !cancelled && setPng(url));
    return () => {
      cancelled = true;
    };
  }, [table]);

  if (!table) return <Dialog open={false} onClose={onClose} title="QR Code">{null}</Dialog>;

  const download = async (ext: "png" | "svg") => {
    const href = ext === "png" ? await qrPngDataUrl(table.url, 1600) : URL.createObjectURL(new Blob([await qrSvg(table.url)], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = qrFileName(table.label, ext);
    a.click();
    if (ext === "svg") setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(table.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onMessage({ ok: false, message: "Não foi possível copiar. Selecione o link e copie manualmente." });
    }
  };

  const writeNfc = async () => {
    setNfcError(null);
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
      const writer = new Reader();
      setNfcState("waiting");
      await writer.write({ records: [{ recordType: "url", data: table.url }] });
      setNfcState("done");
      const res = await markNfcLinkedAction(table.id);
      if (!res.ok) onMessage(res);
    } catch (error) {
      setNfcState("error");
      const name = (error as Error)?.name;
      setNfcError(
        name === "NotAllowedError"
          ? "Permissão de NFC negada. Autorize o uso de NFC para este site."
          : name === "NotSupportedError"
            ? "Este aparelho não suporta gravação NFC pelo navegador."
            : "Não foi possível gravar a tag. Aproxime novamente e mantenha o celular parado.",
      );
    }
  };

  return (
    <Dialog open onClose={onClose} title={`QR Code · ${tableDisplayName(table.label)}`} description={table.is_active ? undefined : "Atenção: esta mesa está desativada e não aceita chamadas."}>
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <div className="mx-auto w-full max-w-[220px] rounded-2xl border border-line bg-white p-3">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt={`QR Code da ${tableDisplayName(table.label)}`} className="h-auto w-full" />
          ) : (
            <div className="aspect-square animate-pulse rounded-lg bg-canvas" />
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted">Link público da mesa</p>
            <p className="mt-1 break-all rounded-lg bg-canvas px-3 py-2 font-mono text-xs text-ink">{table.url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
            <a href={table.url} target="_blank" rel="noopener" className={buttonClasses("secondary", "sm")}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Testar
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void download("png")}>
              <Download className="h-4 w-4" aria-hidden="true" /> PNG
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void download("svg")}>
              <Download className="h-4 w-4" aria-hidden="true" /> SVG
            </Button>
            <Link href={`/painel/mesas/imprimir?ids=${table.id}`} target="_blank" className={buttonClasses("secondary", "sm")}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line p-4">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Nfc className="h-4 w-4 text-brand-600" aria-hidden="true" /> Tag NFC
        </p>
        {table.nfc_linked_at ? (
          <p className="mt-1 text-xs text-muted">
            Tag registrada em {formatDateTime(table.nfc_linked_at, timeZone)}
            {table.nfc_tag_id ? ` · ${table.nfc_tag_id}` : ""}.
          </p>
        ) : null}
        {nfcState === "unsupported" ? (
          <p className="mt-2 text-sm text-muted">
            Para gravar pelo navegador, abra esta tela no Chrome para Android com NFC ligado. Em outros aparelhos, use um app gravador de NFC e grave um registro
            do tipo <strong>URL</strong> com o link acima. Depois, toque em “Registrar tag gravada”.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Toque em “Gravar tag” e aproxime uma tag NFC (NTAG213/215/216) da parte de trás do celular.</p>
        )}
        {nfcError ? <p className="mt-2 text-sm font-medium text-danger-700" role="alert">{nfcError}</p> : null}
        {nfcState === "done" ? <p className="mt-2 text-sm font-medium text-success-700" role="status">Tag gravada com sucesso!</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {nfcState !== "unsupported" ? (
            <Button size="sm" onClick={() => void writeNfc()} loading={nfcState === "waiting"} loadingText="Aproxime a tag…">
              Gravar tag
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const res = await markNfcLinkedAction(table.id);
              onMessage(res);
              if (res.ok) onClose();
            }}
          >
            Registrar tag gravada
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
