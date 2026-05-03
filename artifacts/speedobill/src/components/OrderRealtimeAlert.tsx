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

interface PaymentRow {
  id: string;
  hotel_id: string;
  table_id: string | null;
  table_number: number | null;
  method: string;
  amount: number;
  tip_amount: number;
  utr: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
}

interface QueuedPayment {
  id: string;
  tableLabel: string;
  method: string;
  amount: number;
  tip: number;
  utr: string | null;
  customerName: string;
  duplicateUtr: boolean;
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
  const seenOrderIds = useRef<Set<string>>(new Set());

  // Hotel payment-verify mode (manual / utr / webhook)
  const [verifyMode, setVerifyMode] = useState<string>("manual");
  useEffect(() => {
    if (!hotelId) return;
    supabase.from("hotels").select("payment_verify_mode").eq("id", hotelId).maybeSingle()
      .then(({ data }) => { if ((data as any)?.payment_verify_mode) setVerifyMode((data as any).payment_verify_mode); });
  }, [hotelId]);

  // Queue of unacknowledged new orders → render as full-screen modal
  const [queue, setQueue] = useState<QueuedOrder[]>([]);

  // Queue of payment attempts awaiting waiter verification
  const [payQueue, setPayQueue] = useState<QueuedPayment[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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
        if (seenOrderIds.current.has(order.id)) return;
        seenOrderIds.current.add(order.id);

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

    // 4) PAYMENT ATTEMPT (guest-initiated UPI/Cash/Card/Razorpay/Request Bill) ----
    const hearsPayment = role === "waiter" || role === "owner" || role === "manager";
    if (hearsPayment) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payment_attempts",
          filter: `hotel_id=eq.${hotelId}`,
        },
        async (payload) => {
          const next = payload.new as PaymentRow;
          if (!next || next.hotel_id !== hotelId) return;
          // Only push to queue when guest needs verification:
          // - UPI (waiter must verify against bank app)
          // - cash / card / razorpay / request_bill (waiter must collect)
          const tableLabel = next.table_number != null
            ? String(next.table_number)
            : await resolveTableLabel(next.table_id);

          // Duplicate UTR detection
          let duplicate = false;
          if (next.utr) {
            const { count } = await supabase
              .from("payment_attempts")
              .select("id", { count: "exact", head: true })
              .eq("hotel_id", hotelId)
              .eq("utr", next.utr)
              .neq("id", next.id);
            duplicate = (count ?? 0) > 0;
          }

          void playClip(PAID_SOUND, 0.9);
          try { navigator.vibrate?.([90, 60, 90, 60, 200]); } catch {}

          setPayQueue((q) =>
            q.some((p) => p.id === next.id) ? q : [...q, {
              id: next.id,
              tableLabel,
              method: next.method,
              amount: Number(next.amount ?? 0),
              tip: Number(next.tip_amount ?? 0),
              utr: next.utr,
              customerName: next.customer_name || "",
              duplicateUtr: duplicate,
            }],
          );

          toast(`💳 Payment from Table ${tableLabel} — verify now`, {
            id: `pay-${next.id}`,
            duration: 12000,
            description: `${next.method.toUpperCase()} • ₹${Math.round(Number(next.amount ?? 0))}`,
          });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hotelId, role, playBell, isAudioEnabled, resolveTableLabel, fetchOrderItems]);

  // Verify / reject a payment attempt
  const verifyPayment = useCallback(async (paymentId: string, accept: boolean, reason?: string) => {
    setVerifyingId(paymentId);
    const update: any = {
      status: accept ? "verified" : "rejected",
      verified_by: user?.id ?? null,
      verified_by_name: user?.email ?? null,
      verified_at: new Date().toISOString(),
    };
    if (!accept && reason) update.rejection_reason = reason;
    const { error } = await supabase.from("payment_attempts").update(update).eq("id", paymentId);
    setVerifyingId(null);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    setPayQueue((q) => q.filter((p) => p.id !== paymentId));
    toast.dismiss(`pay-${paymentId}`);
    toast.success(accept ? "Payment verified ✅" : "Payment rejected");
  }, [user?.id, user?.email]);

  // Render full-screen modal queue ----------------------------------------
  const current = queue[0];
  const currentPayment = payQueue[0];

  if (!current && !currentPayment) return null;

  const orderModal = current ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="New order alert"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in" />

      <div className="relative w-full max-w-lg rounded-3xl bg-card border-4 border-primary shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
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
  ) : null;

  const paymentModal = currentPayment ? (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Verify payment"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in" />
      <div className="relative w-full max-w-md rounded-3xl bg-card border-4 border-emerald-500 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-2 bg-emerald-500 animate-pulse" />
        <div className="p-6 sm:p-7 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Wallet className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            💳 Verify {currentPayment.method.toUpperCase()} Payment
          </p>
          <h2 className="text-2xl sm:text-3xl font-black">
            Table {currentPayment.tableLabel}
          </h2>
          <p className="text-3xl font-black text-emerald-600">
            ₹{Math.round(currentPayment.amount + currentPayment.tip)}
            {currentPayment.tip > 0 && (
              <span className="block text-xs font-medium text-muted-foreground mt-0.5">
                Bill ₹{Math.round(currentPayment.amount)} + Tip ₹{Math.round(currentPayment.tip)}
              </span>
            )}
          </p>

          {currentPayment.utr && (
            <div className="bg-muted/50 rounded-2xl p-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                UTR / Transaction ID
              </p>
              <p className="text-lg font-mono font-bold tracking-wider">{currentPayment.utr}</p>
              {currentPayment.duplicateUtr && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">
                  ⚠ This UTR was already used. Possible fraud — verify carefully.
                </p>
              )}
            </div>
          )}

          {currentPayment.customerName && (
            <p className="text-xs text-muted-foreground">From: {currentPayment.customerName}</p>
          )}

          {currentPayment.method === "upi" && (
            <p className="text-[11px] text-muted-foreground">
              👉 Open your UPI app and confirm the payment of ₹{Math.round(currentPayment.amount + currentPayment.tip)} was received.
            </p>
          )}
          {currentPayment.method === "cash" && (
            <p className="text-[11px] text-muted-foreground">
              Collect cash from the table, then mark verified.
            </p>
          )}
          {currentPayment.method === "card" && (
            <p className="text-[11px] text-muted-foreground">
              Bring the POS machine to the table.
            </p>
          )}
          {currentPayment.method === "request_bill" && (
            <p className="text-[11px] text-muted-foreground">
              Take the printed bill to the table.
            </p>
          )}

          {/* Manual sound-box mode: one-tap "Payment received" */}
          {verifyMode === "manual" && !currentPayment.utr ? (
            <div className="space-y-2 pt-2">
              <button
                onClick={() => verifyPayment(currentPayment.id, true)}
                disabled={verifyingId === currentPayment.id}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-[56px]"
              >
                <CheckCircle2 className="h-5 w-5" />
                Payment Received ✓
              </button>
              <button
                onClick={() => verifyPayment(currentPayment.id, false, "Waiter rejected")}
                disabled={verifyingId === currentPayment.id}
                className="w-full py-2.5 rounded-2xl bg-red-500/10 text-red-600 font-semibold border-2 border-red-500/30 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1 text-sm"
              >
                <X className="h-3.5 w-3.5" /> Not received yet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => verifyPayment(currentPayment.id, false, "Waiter rejected")}
                disabled={verifyingId === currentPayment.id}
                className="py-3 rounded-2xl bg-red-500/10 text-red-600 font-bold border-2 border-red-500/40 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <X className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={() => verifyPayment(currentPayment.id, true)}
                disabled={verifyingId === currentPayment.id}
                className="py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="h-4 w-4" /> Verify
              </button>
            </div>
          )}

          {payQueue.length > 1 && (
            <p className="text-xs text-muted-foreground pt-1">
              +{payQueue.length - 1} more payment{payQueue.length - 1 === 1 ? "" : "s"} waiting
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {paymentModal}
      {orderModal}
    </>,
    document.body,
  );
}
