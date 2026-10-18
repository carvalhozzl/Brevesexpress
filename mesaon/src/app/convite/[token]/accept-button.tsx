"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState } from "@/lib/validation/common";
import { acceptInvitationAction } from "./actions";

export function AcceptInvitation({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Button type="submit" size="lg" className="w-full" loading={pending} loadingText="Entrando na equipe…">
        Aceitar convite
      </Button>
    </form>
  );
}
