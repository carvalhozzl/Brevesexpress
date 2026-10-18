export function LegalPage({ title, updated, children, draft = false }: { title: string; updated?: string; children: React.ReactNode; draft?: boolean }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {updated ? <p className="mt-2 text-sm text-muted">Última atualização: {updated}</p> : null}
      {draft ? (
        <p className="mt-6 rounded-xl border border-warning-500/40 bg-warning-50 p-4 text-sm text-navy-900">
          Modelo inicial. Antes de publicar comercialmente, revise este texto com assessoria jurídica e complete os dados do controlador (razão social,
          CNPJ, endereço e canal do encarregado).
        </p>
      ) : null}
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-navy-900/85 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}
