/**
 * Traduz códigos de erro do banco/servidor para mensagens em pt-BR.
 * Nunca exibe a mensagem técnica original ao usuário.
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  NOT_FOUND: "Registro não encontrado.",
  SLUG_TAKEN: "Este identificador já está em uso por outro estabelecimento. Escolha outro.",
  INVALID_TIMEZONE: "Fuso horário inválido.",
  RESTAURANT_LIMIT: "Você atingiu o número máximo de restaurantes por conta.",
  PROFILE_NOT_FOUND: "Perfil não encontrado. Saia e entre novamente.",
  INVALID_ROLE: "Função inválida.",
  INVALID_EMAIL: "E-mail inválido.",
  ALREADY_MEMBER: "Essa pessoa já faz parte da equipe.",
  INVITATION_INVALID: "Convite inválido, expirado ou já utilizado.",
  INVITATION_EMAIL_MISMATCH: "Este convite foi enviado para outro e-mail. Entre com o e-mail convidado.",
  LAST_OWNER: "O restaurante precisa ter pelo menos um proprietário ativo.",
  PLAN_TABLE_LIMIT: "Seu plano atingiu o limite de mesas.",
  PLAN_MEMBER_LIMIT: "Seu plano atingiu o limite de pessoas na equipe.",
  ALREADY_IN_STATUS: "Esta chamada já foi atualizada por outra pessoa.",
  INVALID_TRANSITION: "Não é possível mudar a chamada para esse status.",
  INVALID_RANGE: "Período inválido (máximo de 400 dias).",
  INVALID_INPUT: "Dados inválidos.",
  NOT_CONFIGURED: "O servidor ainda não foi configurado. Veja o README.",
  NETWORK: "Não foi possível conectar ao servidor. Verifique sua conexão.",
};

const DEFAULT_MESSAGE = "Algo deu errado. Tente novamente em instantes.";

type MaybeError = { message?: string; code?: string } | null | undefined;

export function errorCode(error: MaybeError): string | null {
  if (!error?.message) return null;
  const msg = error.message.trim();
  if (MESSAGES[msg]) return msg;
  if (/duplicate key|unique constraint/i.test(msg)) return "DUPLICATE";
  if (/row-level security|permission denied/i.test(msg)) return "FORBIDDEN";
  if (/JWT|jwt expired|invalid claim/i.test(msg)) return "NOT_AUTHENTICATED";
  if (/fetch failed|network|Failed to fetch/i.test(msg)) return "NETWORK";
  return null;
}

export function userMessage(error: MaybeError, fallback = DEFAULT_MESSAGE, overrides: Record<string, string> = {}): string {
  const code = errorCode(error);
  if (!code) return fallback;
  return overrides[code] ?? MESSAGES[code] ?? fallback;
}

/** Mensagens do Supabase Auth em pt-BR. */
export function authMessage(error: MaybeError): string {
  const msg = error?.message ?? "";
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (/User already registered|already been registered/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/Password should be|weak password/i.test(msg)) return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/same.*password|different from the old/i.test(msg)) return "A nova senha deve ser diferente da anterior.";
  if (/fetch failed|network/i.test(msg)) return MESSAGES.NETWORK;
  return DEFAULT_MESSAGE;
}

/** Log no servidor sem vazar dados sensíveis. */
export function logServerError(context: string, error: unknown) {
  const e = error as { message?: string; code?: string };
  console.error(`[mesaon] ${context}:`, e?.code ?? "", e?.message ?? String(error));
}
