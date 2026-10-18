import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";

export function ConfigRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <Card className="max-w-lg p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-bold text-ink">Configuração pendente</h1>
        <p className="mt-2 text-muted">
          Para usar o painel, conecte o MesaOn a um projeto Supabase: copie <code>.env.example</code> para <code>.env.local</code>, preencha as chaves e
          aplique as migrações em <code>supabase/migrations</code>. O passo a passo está no README.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Voltar ao site
        </Link>
      </Card>
    </div>
  );
}
