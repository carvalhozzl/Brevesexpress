import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/requests";

const tones: Record<StatusTone | "danger", string> = {
  warning: "bg-warning-50 text-warning-700 ring-warning-500/30",
  info: "bg-brand-50 text-brand-700 ring-brand-500/25",
  brand: "bg-navy-900 text-white ring-navy-900",
  success: "bg-success-50 text-success-700 ring-success-500/30",
  neutral: "bg-canvas text-muted ring-navy-900/10",
  danger: "bg-danger-50 text-danger-700 ring-danger-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: StatusTone | "danger";
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
