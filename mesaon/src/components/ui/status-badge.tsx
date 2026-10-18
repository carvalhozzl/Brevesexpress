import { Badge } from "./badge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/requests";
import type { RequestStatus } from "@/lib/supabase/database.types";

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
