import { cn } from "@/lib/utils";

/**
 * Símbolo do MesaOn: uma mesa vista de frente emitindo um "sinal" de chamada.
 * Funciona em fundos claros (variant="dark") e escuros (variant="light").
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="32" height="32" rx="9" fill="#2563EB" />
      <path d="M11.6 11.4a6.2 6.2 0 0 1 8.8 0" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14.1 13.9a2.6 2.6 0 0 1 3.8 0" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" opacity="0.85" />
      <rect x="6.5" y="17" width="19" height="3.4" rx="1.7" fill="#fff" />
      <rect x="9.6" y="20" width="2.8" height="6.2" rx="1.4" fill="#fff" />
      <rect x="19.6" y="20" width="2.8" height="6.2" rx="1.4" fill="#fff" />
    </svg>
  );
}

export function Logo({
  variant = "dark",
  className,
  markClassName,
}: {
  variant?: "dark" | "light";
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className={cn("text-[1.3rem] font-bold leading-none tracking-tight", variant === "dark" ? "text-navy-900" : "text-white")}>
        Mesa<span className={variant === "dark" ? "text-brand-600" : "text-brand-400"}>On</span>
      </span>
      <span className="sr-only">MesaOn</span>
    </span>
  );
}
