/**
 * Tipos do banco (espelham supabase/migrations).
 * Podem ser regenerados com: npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 * (mantenha os aliases exportados no fim do arquivo).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "owner" | "manager" | "attendant";
export type RequestStatus = "pending" | "received" | "in_progress" | "completed" | "cancelled";
export type RestaurantStatus = "active" | "suspended";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

type Timestamps = { created_at: string; updated_at: string };

export type SubscriptionPlanRow = Timestamps & {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  billing_period: "monthly" | "yearly";
  max_tables: number | null;
  max_members: number | null;
  features: Json;
  highlights: string[];
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
};

export type ProfileRow = Timestamps & {
  id: string;
  full_name: string | null;
  email: string | null;
  is_platform_admin: boolean;
};

export type RestaurantRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: RestaurantStatus;
  suspended_reason: string | null;
  feature_overrides: Json;
  created_by: string | null;
};

export type RestaurantMemberRow = Timestamps & {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  invited_by: string | null;
};

export type RestaurantInvitationRow = {
  id: string;
  restaurant_id: string;
  email: string;
  role: MemberRole;
  token_hash: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type RestaurantTableRow = Timestamps & {
  id: string;
  restaurant_id: string;
  label: string;
  public_token: string;
  is_active: boolean;
  nfc_tag_id: string | null;
  nfc_linked_at: string | null;
};

export type ServiceTypeRow = Timestamps & {
  id: string;
  restaurant_id: string;
  name: string;
  icon: ServiceIcon;
  sort_order: number;
  is_active: boolean;
};

export type ServiceIcon = "waiter" | "bill" | "water" | "help" | "cutlery" | "napkin" | "ice" | "card" | "baby" | "other";

export type ServiceRequestRow = {
  id: string;
  restaurant_id: string;
  table_id: string;
  service_type_id: string | null;
  table_label: string;
  service_type_name: string;
  status: RequestStatus;
  assigned_to: string | null;
  client_ip_hash: string | null;
  created_at: string;
  received_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
};

export type RestaurantSubscriptionRow = Timestamps & {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

export type AuditLogRow = {
  id: number;
  restaurant_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

type Table<Row, InsertKeys extends keyof Row, UpdateKeys extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, InsertKeys>;
  Update: Partial<Pick<Row, UpdateKeys>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      subscription_plans: Table<
        SubscriptionPlanRow,
        "code" | "name",
        | "name"
        | "description"
        | "price_cents"
        | "billing_period"
        | "max_tables"
        | "max_members"
        | "features"
        | "highlights"
        | "is_public"
        | "is_active"
        | "sort_order"
      >;
      profiles: Table<ProfileRow, "id", "full_name">;
      restaurants: Table<RestaurantRow, "name" | "slug", "name" | "timezone">;
      restaurant_members: Table<RestaurantMemberRow, "restaurant_id" | "user_id", never>;
      restaurant_invitations: Table<RestaurantInvitationRow, "restaurant_id" | "email" | "role" | "token_hash", never>;
      restaurant_tables: Table<RestaurantTableRow, "restaurant_id" | "label", "label" | "is_active" | "nfc_tag_id" | "nfc_linked_at">;
      service_types: Table<ServiceTypeRow, "restaurant_id" | "name", "name" | "icon" | "sort_order" | "is_active">;
      service_requests: Table<ServiceRequestRow, "restaurant_id" | "table_id" | "table_label" | "service_type_name", never>;
      restaurant_subscriptions: Table<RestaurantSubscriptionRow, "restaurant_id" | "plan_id", never>;
      audit_logs: Table<AuditLogRow, "action", never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_restaurant: { Args: { p_name: string; p_slug: string; p_timezone?: string }; Returns: string };
      create_invitation: { Args: { p_restaurant_id: string; p_email: string; p_role: MemberRole }; Returns: string };
      get_invitation: { Args: { p_token: string }; Returns: Json };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      update_member: { Args: { p_member_id: string; p_role?: MemberRole | null; p_is_active?: boolean | null }; Returns: undefined };
      regenerate_table_token: { Args: { p_table_id: string }; Returns: string };
      update_request_status: { Args: { p_request_id: string; p_status: RequestStatus }; Returns: Json };
      public_get_table: { Args: { p_token: string }; Returns: Json };
      public_create_request: { Args: { p_token: string; p_service_type_id: string; p_ip_hash?: string | null }; Returns: Json };
      public_cancel_request: { Args: { p_token: string; p_request_id: string }; Returns: Json };
      purge_request_ip_hashes: { Args: Record<string, never>; Returns: number };
      restaurant_stats: {
        Args: {
          p_restaurant_id: string;
          p_from: string;
          p_to: string;
          p_table_id?: string | null;
          p_service_type_id?: string | null;
          p_assigned_to?: string | null;
          p_status?: RequestStatus | null;
        };
        Returns: Json;
      };
      restaurant_features: { Args: { p_restaurant_id: string }; Returns: Json };
      admin_set_restaurant_status: {
        Args: { p_restaurant_id: string; p_status: RestaurantStatus; p_reason?: string | null };
        Returns: undefined;
      };
      admin_set_subscription: {
        Args: { p_restaurant_id: string; p_plan_id: string; p_status?: SubscriptionStatus };
        Returns: undefined;
      };
      admin_set_feature_overrides: { Args: { p_restaurant_id: string; p_overrides: Json }; Returns: undefined };
      admin_overview: { Args: Record<string, never>; Returns: Json };
      admin_restaurant_usage: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          status: RestaurantStatus;
          created_at: string;
          plan_id: string | null;
          plan_name: string | null;
          subscription_status: SubscriptionStatus | null;
          tables_count: number;
          members_count: number;
          requests_30d: number;
          feature_overrides: Json;
        }[];
      };
    };
    Enums: {
      member_role: MemberRole;
      request_status: RequestStatus;
      restaurant_status: RestaurantStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
