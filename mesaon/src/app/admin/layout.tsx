import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfigRequired } from "@/components/panel/config-required";
import { isSupabaseConfigured } from "@/lib/env";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Administração", template: "%s · Admin MesaOn" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Visão geral e restaurantes" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!isSupabaseConfigured()) return <ConfigRequired />;
  const { allowed, profile } = await requirePlatformAdmin();

  if (!allowed) {
    return (
      <main id="conteudo" className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <Card className="max-w-md">
          <EmptyState
            icon={ShieldAlert}
            title="Acesso restrito"
            description="Esta área é exclusiva para administradores da plataforma MesaOn."
            action={<Link href="/painel" className="text-sm font-semibold text-brand-700 hover:underline">Voltar ao painel</Link>}
          />
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/10 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo variant="light" />
            <span className="rounded-md bg-warning-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy-950">Admin</span>
          </Link>
          <nav aria-label="Administração" className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-white/60">{profile?.email}</span>
            <Link href="/painel" className="font-medium text-white/80 hover:text-white">
              Painel
            </Link>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
