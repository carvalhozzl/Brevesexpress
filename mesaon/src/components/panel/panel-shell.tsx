"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu, Shield, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PanelNav } from "./panel-nav";
import { cn } from "@/lib/utils";

export type ShellProps = {
  canManage: boolean;
  isPlatformAdmin: boolean;
  userName: string;
  roleLabel: string;
  switcher: React.ReactNode;
  children: React.ReactNode;
};

export function PanelShell({ canManage, isPlatformAdmin, userName, roleLabel, switcher, children }: ShellProps) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <Link href="/painel" className="rounded-lg">
          <Logo variant="light" />
        </Link>
        <button type="button" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      {switcher}
      <PanelNav canManage={canManage} onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
        {isPlatformAdmin ? (
          <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white">
            <Shield className="h-[18px] w-[18px]" aria-hidden="true" /> Administração
          </Link>
        ) : null}
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-white">{userName}</p>
          <p className="text-xs text-white/60">{roleLabel}</p>
        </div>
        <form action="/auth/sair" method="post">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr] print:block">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto bg-navy-900 lg:block print:hidden">{sidebar}</aside>

      {/* menu móvel */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-navy-950/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cn("absolute inset-y-0 left-0 w-72 overflow-y-auto bg-navy-900 transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
          {open ? sidebar : null}
        </aside>
      </div>

      <div className="min-w-0">
        <header className="print:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-ink hover:bg-canvas" aria-label="Abrir menu" aria-expanded={open}>
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
