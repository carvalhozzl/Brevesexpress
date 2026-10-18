import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
        {!isSupabaseConfigured() ? (
          <Alert tone="warning" className="mt-5" title="Configuração pendente">
            O Supabase ainda não foi configurado neste ambiente. Preencha o arquivo <code>.env.local</code> conforme o README.
          </Alert>
        ) : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </>
  );
}
