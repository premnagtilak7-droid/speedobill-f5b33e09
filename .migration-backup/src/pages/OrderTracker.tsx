/**
 * Public guest-facing order tracker.
 * Route: /track/:orderId
 *
 * - Subscribes to Supabase Realtime for the specific order + its KOT tickets.
 * - Vibrates and shows a status when the order moves to "ready".
 * - No auth required; relies on the unguessable order UUID + RLS policy
 *   "Public can read order for tracking" / kot_tickets equivalent.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ChefHat, Clock, Package, Utensils } from "lucide-react";

interface OrderRow {
  id: string;
  hotel_id: string;
  table_id: string | null;
  total: number | null;
  status: string;
  created_at: string;
}

interface KotRow {
  id: string;
  order_id: string;
  status: string;
  ready_at: string | null;
  started_at: string | null;
}

type Stage = "received" | "preparing" | "ready" | "served" | "billed";

const STAGE_LABEL: Record<Stage, { title: string; sub: string; emoji: string }> = {
  received:  { title: "Order received",      sub: "We've got your order — sending it to the kitchen.", emoji: "📝" },
  preparing: { title: "Your food is being prepared", sub: "The chef is on it!", emoji: "👨‍🍳" },
  ready:     { title: "Your food is ready! 🎉",      sub: "Please collect it from the counter.", emoji: "🍽️" },
  served:    { title: "Enjoy your meal",     sub: "Bon appétit!", emoji: "😋" },
  billed:    { title: "Order completed",     sub: "Thanks for dining with us!", emoji: "✅" },
};

function deriveStage(order: OrderRow | null, kots: KotRow[]): Stage {
  if (!order) return "received";
  if (order.status === "billed") return "billed";
  if (order.status === "completed" || order.status === "served") return "served";
  if (kots.length === 0) return "received";
  if (kots.every((k) => k.status === "ready" || k.status === "served")) return "ready";
  if (kots.some((k) => k.status === "in_progress" || k.status === "preparing" || k.started_at))
    return "preparing";
  return "received";
}

const STAGE_ORDER: Stage[] = ["received", "preparing", "ready", "served"];

export default function OrderTracker() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [kots, setKots] = useState<KotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const lastStageRef = useRef<Stage | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      const [{ data: o }, { data: k }] = await Promise.all([
        supabase.from("orders").select("id,hotel_id,table_id,total,status,created_at").eq("id", orderId).maybeSingle(),
        supabase.from("kot_tickets").select("id,order_id,status,ready_at,started_at").eq("order_id", orderId),
      ]);
      if (cancelled) return;
      if (!o) {
        setNotFound(true);
      } else {
        setOrder(o as OrderRow);
        setKots((k as KotRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(`tracker-${orderId}`);

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
      (payload) => setOrder(payload.new as OrderRow),
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "kot_tickets", filter: `order_id=eq.${orderId}` },
      (payload) => {
        setKots((prev) => {
          const next = payload.new as KotRow | null;
          const old = payload.old as KotRow | null;
          if (payload.eventType === "DELETE" && old) return prev.filter((r) => r.id !== old.id);
          if (!next) return prev;
          const idx = prev.findIndex((r) => r.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        });
      },
    );

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const stage = useMemo(() => deriveStage(order, kots), [order, kots]);

  // Vibrate on stage change (especially when ready)
  useEffect(() => {
    if (lastStageRef.current === null) {
      lastStageRef.current = stage;
      return;
    }
    if (lastStageRef.current === stage) return;
    lastStageRef.current = stage;
    try {
      if (stage === "ready") navigator.vibrate?.([300, 120, 300, 120, 500]);
      else navigator.vibrate?.(80);
    } catch { /* noop */ }
  }, [stage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Order not found</h1>
          <p className="text-sm text-muted-foreground">
            This tracking link looks invalid or has expired. Please check with the restaurant.
          </p>
        </div>
      </div>
    );
  }

  const meta = STAGE_LABEL[stage];
  const stageIdx = STAGE_ORDER.indexOf(stage === "billed" ? "served" : stage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 sm:p-6">
      <div className="max-w-md mx-auto pt-6 sm:pt-12">
        {/* Hero status card */}
        <div className="rounded-3xl border-2 border-primary/30 bg-card shadow-xl overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="p-6 sm:p-8 text-center">
            <div className="text-5xl mb-3" aria-hidden>{meta.emoji}</div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              {meta.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{meta.sub}</p>

            {/* Progress bar */}
            <div className="grid grid-cols-4 gap-1.5 mb-6">
              {STAGE_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-colors ${
                    i <= stageIdx ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Steps */}
            <ul className="text-left space-y-3">
              <Step active={stageIdx >= 0} done={stageIdx > 0} icon={<Clock className="h-4 w-4" />} label="Order received" />
              <Step active={stageIdx >= 1} done={stageIdx > 1} icon={<ChefHat className="h-4 w-4" />} label="Being prepared" />
              <Step active={stageIdx >= 2} done={stageIdx > 2} icon={<Utensils className="h-4 w-4" />} label="Ready to collect" />
              <Step active={stageIdx >= 3} done={stage === "billed"} icon={<CheckCircle2 className="h-4 w-4" />} label="Served / Completed" />
            </ul>
          </div>

          <div className="border-t border-border/50 bg-muted/30 px-6 py-4 text-center">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5">Order ID</p>
            <p className="font-mono text-xs text-foreground/80 break-all">{order.id.slice(0, 8)}…</p>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Status updates automatically — keep this page open.
        </p>
        <p className="text-center text-[10px] text-muted-foreground/70 mt-2">
          Powered by SpeedoBill
        </p>
      </div>
    </div>
  );
}

function Step({
  active,
  done,
  icon,
  label,
}: {
  active: boolean;
  done: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          done
            ? "bg-emerald-500/20 text-emerald-600"
            : active
              ? "bg-primary/15 text-primary animate-pulse"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : icon}
      </span>
      <span
        className={`text-sm ${
          active || done ? "text-foreground font-medium" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </li>
  );
}
