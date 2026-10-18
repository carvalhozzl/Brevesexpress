import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export function AccessDenied({ text = "Apenas proprietários e gerentes podem acessar esta área." }: { text?: string }) {
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title="Usuário sem permissão"
        description={text}
        action={
          <Link href="/painel/chamadas" className={buttonClasses("secondary", "md")}>
            Ir para as chamadas
          </Link>
        }
      />
    </Card>
  );
}
