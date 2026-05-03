import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "order_placed"
  | "order_billed"
  | "order_voided"
  | "item_voided"
  | "discount_applied"
  | "menu_updated"
  | "menu_added"
  | "menu_deleted"
  | "settings_changed"
  | "staff_login"
  | "staff_added"
  | "table_merged"
  | "table_unmerged"
  | "loyalty_updated";

interface AuditPayload {
  hotelId: string;
  action: AuditAction;
  performedBy: string;
  performerName?: string | null;
  tableNumber?: number | null;
  orderId?: string | null;
  details?: string;
}

/**
 * Fire-and-forget audit logger. Never throws — failures are swallowed
 * so business flows are never blocked by logging issues.
 */
export const writeAudit = async (payload: AuditPayload): Promise<void> => {
  try {
    await supabase.from("audit_logs").insert({
      hotel_id: payload.hotelId,
      action: payload.action,
      performed_by: payload.performedBy,
      performer_name: payload.performerName ?? null,
      table_number: payload.tableNumber ?? null,
      order_id: payload.orderId ?? null,
      details: payload.details ?? null,
    });
  } catch {
    // Intentionally silent — audit failures must not break workflows.
  }
};
