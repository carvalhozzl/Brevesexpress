"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#inicio", label: "Início" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#para-restaurantes", label: "Para restaurantes" },
  { href: "/#precos", label: "Preços" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-200",
        scrolled || open ? "border-line bg-white/90 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="MesaOn — página inicial" className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-navy-900/75 transition-colors hover:bg-navy-900/5 hover:text-navy-900">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/entrar" className={buttonClasses("ghost", "sm")}>
            Entrar
          </Link>
          <Link href="/cadastro" className={buttonClasses("primary", "sm")}>
            Começar agora
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl text-navy-900 hover:bg-navy-900/5 lg:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div id="menu-mobile" hidden={!open} className="border-t border-line bg-white lg:hidden">
        <nav aria-label="Principal (celular)" className="mx-auto max-w-6xl px-4 py-3">
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium text-navy-900 hover:bg-canvas">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Link href="/entrar" className={buttonClasses("secondary", "md")}>
              Entrar
            </Link>
            <Link href="/cadastro" className={buttonClasses("primary", "md")}>
              Começar agora
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
