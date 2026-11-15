export type AppRole = "owner" | "manager" | "member";
export type Capabilities = {
  management: boolean;
  manage_owner: boolean;
  manage_members: boolean;
  manage_finance: boolean;
  manage_documents: boolean;
  manage_settings: boolean;
  view_audit: boolean;
};
export type BookingStatus =
  "inquiry" | "negotiation" | "confirmed" | "completed" | "cancelled";
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: AppRole;
};
export type EventRecord = {
  id: string;
  name: string;
  location: string;
  starts_at: string;
  duration_minutes: number;
  contract_value: number;
  booking_status: BookingStatus;
  event_type?: { name: string } | null;
  client_payments?: Array<{
    kind: "deposit" | "installment" | "settlement" | "refund";
    amount: number;
  }>;
};
