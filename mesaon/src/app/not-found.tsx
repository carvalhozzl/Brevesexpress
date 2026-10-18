import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Logo />
      <p className="mt-10 text-sm font-semibold text-brand-700">Erro 404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-muted">O endereço pode ter mudado ou não existe mais.</p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-8")}>
        Voltar ao início
      </Link>
    </main>
  );
}
