import type { MemberRole } from "@/lib/supabase/database.types";

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  attendant: "Atendente",
};

export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  owner: "Acesso total, incluindo equipe e configurações.",
  manager: "Gerencia mesas, tipos de atendimento, atendentes e relatórios.",
  attendant: "Recebe e atende as chamadas no painel.",
};

/** Apenas para exibir/ocultar controles. A permissão real é verificada no banco. */
export function canManage(role: MemberRole): boolean {
  return role === "owner" || role === "manager";
}
