"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, History, LayoutDashboard, QrCode, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard, manage: false, exact: true },
  { href: "/painel/chamadas", label: "Chamadas", icon: BellRing, manage: false },
  { href: "/painel/mesas", label: "Mesas e QR Codes", icon: QrCode, manage: true },
  { href: "/painel/historico", label: "Histórico", icon: History, manage: false },
  { href: "/painel/relatorios", label: "Relatórios", icon: BarChart3, manage: true },
  { href: "/painel/equipe", label: "Equipe", icon: Users, manage: true },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings, manage: false },
];

export function PanelNav({ canManage, onNavigate }: { canManage: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel">
      <ul className="space-y-1">
        {ITEMS.filter((i) => canManage || !i.manage).map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
