"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function PanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar esta tela"
        description="Pode ser uma falha de conexão com o servidor ou sua sessão pode ter expirado."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </Card>
  );
}
