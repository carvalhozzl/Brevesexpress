import { BellRing, Check, GlassWater, HandPlatter, Receipt, Wifi } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

/**
 * Representação visual do produto (componentes reais de interface, não imagem):
 * um painel do restaurante recebendo a chamada feita pelo celular da mesa.
 * Os dados mostrados são ilustrativos.
 */
export function HeroVisual() {
  return (
    <div className="mx-auto flex w-full max-w-[600px] select-none flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-4" aria-hidden="true">
      {/* Painel do restaurante */}
      <div className="order-2 w-full min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-raised)] sm:order-2">
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-navy-900/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-navy-900/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-navy-900/15" />
          <span className="ml-3 text-[11px] font-medium text-muted">Painel · Chamadas em tempo real</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-success-700">
            <Wifi className="h-3 w-3" /> Ao vivo
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-4 text-center">
          {[
            { k: "Pendentes", v: "1", c: "text-warning-700" },
            { k: "Em atendimento", v: "2", c: "text-brand-700" },
            { k: "Concluídas hoje", v: "38", c: "text-success-700" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-canvas px-2 py-2.5">
              <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
              <p className="text-[10px] font-medium text-muted">{s.k}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-2 p-4">
          <li className="flex items-center gap-3 rounded-xl border-2 border-brand-500 bg-brand-50 p-3 motion-safe:animate-pulse-ring">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">12</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <BellRing className="h-3.5 w-3.5 text-brand-600" /> Chamar garçom
              </p>
              <p className="text-[11px] text-muted">Mesa 12 · há 8 s</p>
            </div>
            <span className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">Aceitar</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-sm font-bold text-white">5</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Solicitar a conta</p>
              <p className="text-[11px] text-muted">Mesa 5 · Em atendimento · Ana</p>
            </div>
            <span className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink">Concluir</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-line p-3 opacity-70">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-sm font-bold text-white">8</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Pedir água</p>
              <p className="text-[11px] text-muted">Mesa 8 · Em atendimento · João</p>
            </div>
            <span className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink">Concluir</span>
          </li>
        </ul>
      </div>

      {/* Celular do cliente */}
      <div className="order-1 w-[210px] shrink-0 rounded-[2rem] border-[6px] border-navy-900 bg-navy-900 shadow-[var(--shadow-raised)] sm:order-1 sm:mb-[-24px] sm:w-[200px]">
        <div className="overflow-hidden rounded-[1.55rem] bg-canvas">
          <div className="mx-auto mt-1.5 h-4 w-16 rounded-full bg-navy-900" />
          <div className="px-3 pb-4 pt-3">
            <div className="flex items-center gap-1.5">
              <LogoMark className="h-5 w-5" />
              <p className="truncate text-[11px] font-semibold text-ink">Restaurante Exemplo</p>
            </div>
            <div className="mt-3 rounded-xl bg-navy-900 px-3 py-2.5 text-white">
              <p className="text-[10px] text-white/70">Você está na</p>
              <p className="text-lg font-bold leading-tight">Mesa 12</p>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-ink">Como podemos ajudar?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-success-500 bg-success-50 px-1 py-2.5 text-center">
                <Check className="h-4 w-4 text-success-700" />
                <span className="text-[10px] font-semibold leading-tight text-success-700">Garçom chamado</span>
              </div>
              {[
                { i: Receipt, t: "Solicitar a conta" },
                { i: GlassWater, t: "Pedir água" },
                { i: HandPlatter, t: "Atendimento" },
              ].map(({ i: Icon, t }) => (
                <div key={t} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-white px-1 py-2.5 text-center">
                  <Icon className="h-4 w-4 text-brand-600" />
                  <span className="text-[10px] font-semibold leading-tight text-ink">{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-lg bg-white px-2.5 py-2 text-[10px] text-muted">
              <span className="font-semibold text-ink">Status:</span> a equipe recebeu seu pedido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
