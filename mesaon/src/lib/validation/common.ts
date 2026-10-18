import { z } from "zod";

export const uuidSchema = z.uuid({ error: "Identificador inválido" });

/** Token público da mesa: hexadecimal minúsculo (gerado pelo banco). */
export const tableTokenSchema = z.string().regex(/^[a-f0-9]{16,64}$/, "Código de mesa inválido");

export type FieldErrors = Record<string, string>;

/** Converte erros do Zod em { campo: "primeira mensagem" }. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Estado padrão retornado pelas Server Actions de formulário. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  /** Valores enviados (sem senhas), para repreencher o formulário após erro. */
  values?: Record<string, string>;
  data?: Record<string, unknown>;
};

export const initialActionState: ActionState = { ok: false };

export function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

/** Valores do formulário sem campos sensíveis. */
export function safeValues(formData: FormData, omit: string[] = ["password", "confirmPassword"]): Record<string, string> {
  const values = formToObject(formData);
  for (const key of omit) delete values[key];
  return values;
}
