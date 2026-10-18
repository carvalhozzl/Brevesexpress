import "server-only";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { tableTokenSchema } from "@/lib/validation/common";

/**
 * Fluxo público da mesa. Única parte do sistema que usa o service_role,
 * sempre chamando funções SQL específicas (public_*), que validam token,
 * mesa ativa, restaurante ativo, antiduplicidade e limites de frequência.
 */

const statusSchema = z.enum(["pending", "received", "in_progress", "completed", "cancelled"]);

const publicRequestSchema = z.object({
  id: z.string(),
  service_type_id: z.string().nullable(),
  service_type_name: z.string(),
  status: statusSchema,
  created_at: z.string(),
  received_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
});

const publicTableSchema = z.object({
  restaurant: z.object({ name: z.string(), is_active: z.boolean(), timezone: z.string() }),
  table: z.object({ label: z.string(), is_active: z.boolean() }),
  service_types: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string() })),
  requests: z.array(publicRequestSchema),
});

export type PublicTable = z.infer<typeof publicTableSchema>;
export type PublicRequest = z.infer<typeof publicRequestSchema>;

const createResultSchema = z.object({
  result: z.enum(["created", "duplicate", "not_found", "table_inactive", "restaurant_unavailable", "invalid_service", "rate_limited"]),
  request: z
    .object({ id: z.string(), status: statusSchema, service_type_name: z.string(), created_at: z.string() })
    .optional(),
});
export type CreateRequestResult = z.infer<typeof createResultSchema>;

const cancelResultSchema = z.object({
  result: z.enum(["cancelled", "not_found", "not_cancellable"]),
  status: statusSchema.optional(),
});

export class PublicServiceError extends Error {}

export function isValidTableToken(token: unknown): token is string {
  return tableTokenSchema.safeParse(token).success;
}

export async function getPublicTable(token: string): Promise<PublicTable | null> {
  if (!isValidTableToken(token)) return null;
  const { data, error } = await getSupabaseServiceClient().rpc("public_get_table", { p_token: token });
  if (error) throw new PublicServiceError(error.message);
  if (data == null) return null;
  return publicTableSchema.parse(data);
}

export async function createPublicRequest(token: string, serviceTypeId: string, ipHash: string | null): Promise<CreateRequestResult> {
  if (!isValidTableToken(token)) return { result: "not_found" };
  const { data, error } = await getSupabaseServiceClient().rpc("public_create_request", {
    p_token: token,
    p_service_type_id: serviceTypeId,
    p_ip_hash: ipHash,
  });
  if (error) throw new PublicServiceError(error.message);
  return createResultSchema.parse(data);
}

export async function cancelPublicRequest(token: string, requestId: string) {
  if (!isValidTableToken(token)) return { result: "not_found" as const };
  const { data, error } = await getSupabaseServiceClient().rpc("public_cancel_request", { p_token: token, p_request_id: requestId });
  if (error) throw new PublicServiceError(error.message);
  return cancelResultSchema.parse(data);
}
