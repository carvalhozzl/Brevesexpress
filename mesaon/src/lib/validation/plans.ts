import { z } from "zod";

const optionalPositiveInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100_000), "Use um número inteiro positivo ou deixe vazio");

/** Preço digitado em reais ("149,90") -> centavos; vazio = sob consulta. */
const priceInput = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100_000_000), "Preço inválido");

export const planSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/, "Código: letras minúsculas, números, - ou _"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().default(""),
  price: priceInput,
  billingPeriod: z.enum(["monthly", "yearly"]),
  maxTables: optionalPositiveInt,
  maxMembers: optionalPositiveInt,
  highlights: z
    .string()
    .max(2000)
    .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12)),
  reports: z.literal("on").optional(),
  csvExport: z.literal("on").optional(),
  isPublic: z.literal("on").optional(),
  isActive: z.literal("on").optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});
