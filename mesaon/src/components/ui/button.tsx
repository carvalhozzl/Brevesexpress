import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 shadow-sm",
  navy: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-canvas shadow-sm",
  ghost: "text-ink hover:bg-navy-900/5",
  success: "bg-success-700 text-white hover:bg-[#166534] shadow-sm",
  danger: "bg-danger-500 text-white hover:bg-danger-700 shadow-sm",
  "danger-ghost": "text-danger-700 hover:bg-danger-50",
  light: "bg-white text-navy-900 hover:bg-brand-50 shadow-sm",
  outlineLight: "border border-white/30 text-white hover:bg-white/10",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-offset-2",
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, loadingText, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
