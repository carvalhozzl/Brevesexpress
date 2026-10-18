import { z } from "zod";
import { uuidSchema } from "./common";

export const tableLabelSchema = z
  .string()
  .trim()
  .min(1, "Informe o número ou nome da mesa")
  .max(30, "Use no máximo 30 caracteres")
  .regex(/^[\p{L}\p{N} ._\-#/()]+$/u, "Use letras, números, espaço e . - _ # / ( )");

export const createTableSchema = z.object({ label: tableLabelSchema });

/** Criação em lote: "1-20" ou "1, 2, 5" ou "Varanda 1" */
export const bulkTablesSchema = z.object({
  from: z.coerce.number().int("Número inteiro").min(1, "Mínimo 1").max(9999),
  to: z.coerce.number().int("Número inteiro").min(1).max(9999),
  prefix: z.string().trim().max(20, "Prefixo muito longo").optional().default(""),
}).refine((d) => d.to >= d.from, { path: ["to"], message: "O final deve ser maior ou igual ao início" })
  .refine((d) => d.to - d.from < 200, { path: ["to"], message: "Crie no máximo 200 mesas por vez" });

export const updateTableSchema = z.object({
  id: uuidSchema,
  label: tableLabelSchema,
  nfcTagId: z.string().trim().max(64, "Identificador muito longo").optional().default(""),
});

export function buildBulkLabels(from: number, to: number, prefix = ""): string[] {
  const labels: string[] = [];
  const p = prefix.trim();
  for (let n = from; n <= to; n++) labels.push(p ? `${p} ${n}` : String(n));
  return labels;
}
