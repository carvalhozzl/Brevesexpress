import { Baby, CircleQuestionMark, CreditCard, GlassWater, HandPlatter, MoreHorizontal, Receipt, Snowflake, Utensils, type LucideIcon } from "lucide-react";
import type { ServiceIcon as ServiceIconKey } from "@/lib/supabase/database.types";

export const SERVICE_ICON_MAP: Record<ServiceIconKey, { icon: LucideIcon; label: string }> = {
  waiter: { icon: HandPlatter, label: "Garçom" },
  bill: { icon: Receipt, label: "Conta" },
  water: { icon: GlassWater, label: "Água" },
  help: { icon: CircleQuestionMark, label: "Ajuda" },
  cutlery: { icon: Utensils, label: "Talheres" },
  napkin: { icon: MoreHorizontal, label: "Guardanapos" },
  ice: { icon: Snowflake, label: "Gelo" },
  card: { icon: CreditCard, label: "Maquininha" },
  baby: { icon: Baby, label: "Cadeirinha" },
  other: { icon: MoreHorizontal, label: "Outro" },
};

export function ServiceIcon({ icon, className }: { icon: string; className?: string }) {
  const entry = SERVICE_ICON_MAP[icon as ServiceIconKey] ?? SERVICE_ICON_MAP.other;
  const Icon = entry.icon;
  return <Icon className={className} aria-hidden="true" />;
}
