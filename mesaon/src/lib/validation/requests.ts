import { z } from "zod";
import { uuidSchema } from "./common";

export const requestStatusSchema = z.enum(["pending", "received", "in_progress", "completed", "cancelled"]);

export const updateRequestStatusSchema = z.object({
  requestId: uuidSchema,
  status: requestStatusSchema,
});

export const createPublicRequestSchema = z.object({
  serviceTypeId: uuidSchema,
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Filtros do histórico/relatórios (vindos da URL — tudo opcional e validado). */
export const historyFiltersSchema = z.object({
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  table: uuidSchema.optional().catch(undefined),
  type: uuidSchema.optional().catch(undefined),
  status: requestStatusSchema.optional().catch(undefined),
  staff: uuidSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type HistoryFilters = z.infer<typeof historyFiltersSchema>;
