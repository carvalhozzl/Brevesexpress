import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const GROUPS = [
  {
    title: "Produto",
    links: [
      { href: "/#como-funciona", label: "Como funciona" },
      { href: "/#recursos", label: "Recursos" },
      { href: "/#demonstracao", label: "Demonstração" },
      { href: "/#precos", label: "Preços" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre", label: "Sobre o MesaOn" },
      { href: "/contato", label: "Contato" },
      { href: "/entrar", label: "Entrar na plataforma" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Política de privacidade" },
      { href: "/cookies", label: "Política de cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy-900 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">Seu atendimento a um toque de distância.</p>
          <p className="mt-1 text-sm font-semibold text-brand-400">Precisou? MesaOn.</p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} MesaOn. Todos os direitos reservados.</p>
          <p>Feito para restaurantes, bares, lanchonetes e cafeterias.</p>
        </div>
      </div>
    </footer>
  );
}
