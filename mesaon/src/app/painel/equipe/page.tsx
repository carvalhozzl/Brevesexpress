import type { Metadata } from "next";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { listMembers, listPendingInvitations } from "@/services/team";
import { getFeatures } from "@/services/requests";
import { PageHeader } from "@/components/ui/page-header";
import { AccessDenied } from "@/components/panel/access-denied";
import { TeamManager } from "@/components/panel/team-manager";

export const metadata: Metadata = { title: "Equipe" };

export default async function EquipePage() {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return <AccessDenied />;
  const [members, invitations, features] = await Promise.all([
    listMembers(ctx.restaurant.id),
    listPendingInvitations(ctx.restaurant.id),
    getFeatures(ctx.restaurant.id),
  ]);
  return (
    <>
      <PageHeader title="Equipe" description="Convide pessoas, defina funções e desative acessos quando alguém sair da equipe." />
      <TeamManager
        members={members}
        invitations={invitations}
        callerRole={ctx.role}
        currentUserId={ctx.user.id}
        maxMembers={features.max_members}
        timeZone={ctx.restaurant.timezone}
      />
    </>
  );
}
