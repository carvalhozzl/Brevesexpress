import Link from "next/link";
import { Check } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import type { PublicPlan } from "@/services/plans";
import { cn } from "@/lib/utils";

export function Pricing({ plans }: { plans: PublicPlan[] }) {
  const highlightIndex = plans.length >= 3 ? 1 : -1;
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((plan, index) => {
        const featured = index === highlightIndex;
        const price = formatBRL(plan.price_cents);
        return (
          <article
            key={plan.id}
            className={cn(
              "flex flex-col rounded-3xl border bg-white p-6 shadow-[var(--shadow-card)]",
              featured ? "border-brand-500 ring-4 ring-brand-500/10" : "border-line",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
              {featured ? <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Mais completo</span> : null}
            </div>
            {plan.description ? <p className="mt-2 min-h-10 text-sm text-muted">{plan.description}</p> : null}
            <div className="mt-5">
              {price ? (
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-ink">{price}</span>
                  <span className="text-sm text-muted">/{plan.billing_period === "yearly" ? "ano" : "mês"}</span>
                </p>
              ) : (
                <p className="text-2xl font-bold tracking-tight text-ink">Sob consulta</p>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-ink">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
            <Link href={price ? "/cadastro" : "/contato"} className={buttonClasses(featured ? "primary" : "secondary", "md", "mt-7 w-full")}>
              {price ? "Começar agora" : "Falar com a equipe"}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
