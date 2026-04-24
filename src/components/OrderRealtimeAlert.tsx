/**
 * Hotel-scoped Supabase Realtime listener for `orders` INSERT events.
 *
 * On every new order in the current user's hotel:
 *   1. Plays the kitchen bell via the global AudioNotificationProvider.
 *   2. Shows a high-priority Sonner toast that stays until the user clicks "OK".
 *   3. Vibrates the device (mobile) for tactile confirmation.
 *
 * Filters by `hotel_id=eq.<hotelId>` server-side so cross-hotel events are
 * never delivered to the client. Roles owner/manager/chef/waiter all hear it
 * — UX teams can layer role gating later by reading useAuth().role.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";
import { toast } from "sonner";

interface OrderRow {
  id: string;
  hotel_id: string;
  table_id: string | null;
  total: number | null;
  created_at: string;
}

export default function OrderRealtimeAlert() {
  const { user, hotelId, role } = useAuth();
  const { playBell } = useAudioNotification();
  // Cache table_id → table_number to avoid re-fetching on every alert
  const tableNumberCache = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || !hotelId) return;

    // Owner/Manager/Chef/Waiter all benefit. Skip silent roles if any.
    if (!role) return;

    const channel = supabase
      .channel(`orders-rt-alert-${hotelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `hotel_id=eq.${hotelId}`,
        },
        async (payload) => {
          const order = payload.new as OrderRow;
          if (!order || order.hotel_id !== hotelId) return;

          // Resolve table number (cached)
          let tableLabel = "—";
          if (order.table_id) {
            const cached = tableNumberCache.current.get(order.table_id);
            if (cached !== undefined) {
              tableLabel = String(cached);
            } else {
              const { data } = await supabase
                .from("restaurant_tables")
                .select("table_number")
                .eq("id", order.table_id)
                .maybeSingle();
              if (data?.table_number != null) {
                tableNumberCache.current.set(order.table_id, data.table_number);
                tableLabel = String(data.table_number);
              }
            }
          }

          const total = Math.round(Number(order.total ?? 0));

          // 🔊 Play bell (no-op until user enables sound from sidebar toggle)
          void playBell();

          // 📳 Vibrate on supporting devices
          try {
            navigator.vibrate?.([200, 80, 200, 80, 300]);
          } catch {}

          // 🟧 Persistent high-priority toast — stays until acknowledged
          toast(`🔔 NEW ORDER! Table ${tableLabel} — ₹${total}`, {
            id: `order-${order.id}`,
            duration: Infinity,
            action: {
              label: "OK",
              onClick: () => toast.dismiss(`order-${order.id}`),
            },
            className: "!bg-primary !text-primary-foreground !border-primary font-bold",
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hotelId, role, playBell]);

  return null;
}
