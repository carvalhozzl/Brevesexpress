import { z } from "zod";
import { uuidSchema } from "./common";

export const SERVICE_ICONS = ["waiter", "bill", "water", "help", "cutlery", "napkin", "ice", "card", "baby", "other"] as const;

export const serviceTypeSchema = z.object({
  name: z.string().trim().min(2, "Use pelo menos 2 caracteres").max(40, "Use no máximo 40 caracteres"),
  icon: z.enum(SERVICE_ICONS, { error: "Ícone inválido" }),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(100),
});

export const updateServiceTypeSchema = serviceTypeSchema.extend({ id: uuidSchema });
