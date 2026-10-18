"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

export function PrintToolbar({ count, size }: { count: number; size: "pequena" | "grande" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const hrefFor = (s: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("tamanho", s);
    return `${pathname}?${p.toString()}`;
  };
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href="/painel/mesas" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para mesas
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink">Etiquetas para impressão</h1>
        <p className="text-sm text-muted">{count} etiqueta(s). Dica: imprima em papel adesivo ou cartão e plastifique.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={hrefFor("pequena")} className={buttonClasses(size === "pequena" ? "navy" : "secondary", "sm")} aria-current={size === "pequena" ? "true" : undefined}>
          Pequena (3 por linha)
        </Link>
        <Link href={hrefFor("grande")} className={buttonClasses(size === "grande" ? "navy" : "secondary", "sm")} aria-current={size === "grande" ? "true" : undefined}>
          Grande (display)
        </Link>
        <Button size="sm" onClick={() => window.print()} disabled={count === 0}>
          <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
        </Button>
      </div>
    </div>
  );
}
