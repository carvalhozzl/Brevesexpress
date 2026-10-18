import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "bg-brand-50 border-brand-200 text-navy-900", icon: Info, iconClass: "text-brand-600" },
  success: { box: "bg-success-50 border-success-500/30 text-navy-900", icon: CheckCircle2, iconClass: "text-success-700" },
  warning: { box: "bg-warning-50 border-warning-500/40 text-navy-900", icon: AlertTriangle, iconClass: "text-warning-700" },
  error: { box: "bg-danger-50 border-danger-500/30 text-navy-900", icon: XCircle, iconClass: "text-danger-700" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: keyof typeof styles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", s.box, className)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-navy-900/80")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
