/**
 * Hotel-scoped, role-aware Supabase Realtime alert system.
 *
 * Subscriptions (all filtered server-side by `hotel_id=eq.<hotelId>`):
 *  1. orders INSERT          → New order
 *       • Chef / Owner / Manager → kitchen bell + FULL-SCREEN Acknowledge modal
 *       • Waiter                 → kitchen bell + sticky toast (no blocking modal)
 *  2. kot_tickets UPDATE     → status flipped to "ready"
 *       • Waiter / Owner / Manager → soft "Ding" + popup toast
 *  3. orders UPDATE          → status flipped to "billed" (= PAID + billed_at set)
 *       • Owner / Manager          → "Cash register" sound + success toast
 *
 * The full-screen modal stays on screen until the staff clicks "Acknowledge".
 * It queues multiple incoming orders so none are missed.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";
import { toast } from "sonner";
import { Bell, CheckCircle2, X, Utensils, ChefHat, Wallet } from "lucide-react";

interface OrderRow {
  id: string;
  hotel_id: string;
  table_id: string | null;
  total: number | null;
  status: string;
  billed_at: string | null;
  payment_method: string | null;
  created_at: string;
}

interface KotRow {
  id: string;
  hotel_id: string;
  order_id: string;
  table_id: string | null;
  status: string;
  ready_at: string | null;
}

interface QueuedOrder {
  id: string;
  tableLabel: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

const NEW_ORDER_SOUND = "/sounds/kitchen_bell.mp3";
const READY_SOUND = "/sounds/ding.mp3";
const PAID_SOUND = "/sounds/cash_register.mp3";

/** Plays a one-shot HTML5 audio clip. Independent of the gesture-locked
 *  Web Audio bell so we can use different sounds per event type. */
function playClip(url: string, volume = 1): Promise<void> {
  try {
    const el = new Audio(url);
    el.volume = volume;
    return el.play().catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

export default function OrderRealtimeAlert() {
  const { user, hotelId, role } = useAuth();
  const { isAudioEnabled, playBell } = useAudioNotification();
  const tableNumberCache = useRef<Map<string, number>>(new Map());

  // Queue of unacknowledged new orders → render as full-screen modal
  const [queue, setQueue] = useState<QueuedOrder[]>([]);

  // Helpers ----------------------------------------------------------------
  const resolveTableLabel = useCallback(
    async (tableId: string | null): Promise<string> => {
      if (!tableId) return "—";
      const cached = tableNumberCache.current.get(tableId);
      if (cached !== undefined) return String(cached);
      const { data } = await supabase
        .from("restaurant_tables")
        .select("table_number")
        .eq("id", tableId)
        .maybeSingle();
      if (data?.table_number != null) {
        tableNumberCache.current.set(tableId, data.table_number);
        return String(data.table_number);
      }
      return "—";
    },
    [],
  );

  const fetchOrderItems = useCallback(
    async (orderId: string): Promise<QueuedOrder["items"]> => {
      const { data } = await supabase
        .from("order_items")
        .select("name, price, quantity")
        .eq("order_id", orderId);
      return (data ?? []).map((r: any) => ({
        name: r.name,
        quantity: Number(r.quantity ?? 1),
        price: Number(r.price ?? 0),
      }));
    },
    [],
  );

  const acknowledge = useCallback((orderId: string) => {
    setQueue((q) => q.filter((o) => o.id !== orderId));
    try { navigator.vibrate?.(20); } catch {}
  }, []);

  // Subscriptions ----------------------------------------------------------
  useEffect(() => {
    if (!user || !hotelId || !role) return;

    const showsBigModal = role === "chef" || role === "owner" || role === "manager";
    const hearsReady = role === "waiter" || role === "owner" || role === "manager";
    const hearsPaid = role === "owner" || role === "manager";

    const channel = supabase.channel(`orders-rt-${hotelId}`);

    // 1) NEW ORDER ---------------------------------------------------------
    channel.on(
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

        const tableLabel = await resolveTableLabel(order.table_id);
        const total = Math.round(Number(order.total ?? 0));

        // Bell + haptic for everyone
        void playBell();
        if (!isAudioEnabled) void playClip(NEW_ORDER_SOUND, 1);
        try { navigator.vibrate?.([220, 90, 220, 90, 320]); } catch {}

        if (showsBigModal) {
          // Pull items for the modal (best-effort)
          const items = await fetchOrderItems(order.id);
          setQueue((q) =>
            q.some((o) => o.id === order.id)
              ? q
              : [...q, { id: order.id, tableLabel, total, items }],
          );
        } else {
          // Waiter just gets a sticky toast
          toast(`🔔 NEW ORDER! Table ${tableLabel} — ₹${total}`, {
            id: `order-${order.id}`,
            duration: Infinity,
            action: {
              label: "OK",
              onClick: () => toast.dismiss(`order-${order.id}`),
            },
            className: "!bg-primary !text-primary-foreground !border-primary font-bold",
          });
        }
      },
    );

    // 2) ORDER READY (kot_tickets) ----------------------------------------
    if (hearsReady) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kot_tickets",
          filter: `hotel_id=eq.${hotelId}`,
        },
        async (payload) => {
          const next = payload.new as KotRow;
          const prev = payload.old as KotRow | null;
          if (!next || next.hotel_id !== hotelId) return;
          if (next.status !== "ready") return;
          if (prev?.status === "ready") return; // ignore repeat updates

          const tableLabel = await resolveTableLabel(next.table_id);
          void playClip(READY_SOUND, 0.9);
          try { navigator.vibrate?.([60, 40, 60]); } catch {}

          toast.success(`🍽️ Order READY — Table ${tableLabel}`, {
            id: `ready-${next.id}`,
            duration: 8000,
            description: "Pick up from the kitchen counter.",
          });
        },
      );
    }

    // 3) ORDER PAID (orders.status='billed') ------------------------------
    if (hearsPaid) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `hotel_id=eq.${hotelId}`,
        },
        async (payload) => {
          const next = payload.new as OrderRow;
          const prev = payload.old as OrderRow | null;
          if (!next || next.hotel_id !== hotelId) return;
          // Treat "billed" + billed_at being newly set as the PAID event
          if (next.status !== "billed") return;
          if (prev?.status === "billed") return;

          const tableLabel = await resolveTableLabel(next.table_id);
          const total = Math.round(Number(next.total ?? 0));
          void playClip(PAID_SOUND, 0.9);
          try { navigator.vibrate?.([40, 30, 40, 30, 80]); } catch {}

          toast.success(`💰 PAID — Table ${tableLabel}`, {
            id: `paid-${next.id}`,
            duration: 6000,
            description: `₹${total} • ${next.payment_method ?? "settled"}`,
          });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hotelId, role, playBell, isAudioEnabled, resolveTableLabel, fetchOrderItems]);

  // Render full-screen modal queue ----------------------------------------
  const current = queue[0];
  if (!current) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="New order alert"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in" />

      {/* Card */}
      <div className="relative w-full max-w-lg rounded-3xl bg-card border-4 border-primary shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Pulsing top stripe */}
        <div className="h-2 bg-primary animate-pulse" />

        <div className="p-6 sm:p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-4 animate-bounce">
            <Bell className="h-8 w-8 text-primary" />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary mb-2">
            🔔 New Order
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-1">
            Table {current.tableLabel}
          </h2>
          <p className="text-2xl font-bold text-primary mb-5">
            ₹{current.total}
          </p>

          {/* Items list */}
          <div className="text-left bg-muted/40 rounded-2xl p-4 mb-6 max-h-[40vh] overflow-y-auto">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5" /> Items
            </p>
            {current.items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Items syncing… check the KDS for full details.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {current.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      <span className="text-primary font-bold">{it.quantity}×</span>{" "}
                      {it.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      ₹{Math.round(it.price * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => acknowledge(current.id)}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2 min-h-[56px]"
          >
            <CheckCircle2 className="h-5 w-5" />
            Acknowledge
          </button>

          {queue.length > 1 && (
            <p className="mt-3 text-xs text-muted-foreground">
              +{queue.length - 1} more {queue.length - 1 === 1 ? "order" : "orders"} waiting
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined"
    ? null
    : createPortal(modal, document.body);
}
