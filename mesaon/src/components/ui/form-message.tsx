import { Alert } from "./alert";
import type { ActionState } from "@/lib/validation/common";

/** Mensagem geral de um formulário (sucesso ou erro), anunciada a leitores de tela. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>;
}
