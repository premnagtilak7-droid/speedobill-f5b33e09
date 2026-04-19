import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIncomingOrders, stopTitleFlash } from "@/hooks/useIncomingOrders";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Check, Clock, ShoppingCart, X, QrCode, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const IncomingOrders = () => {
  const { hotelId } = useAuth();
  const { incomingOrders, dismissOrder } = useIncomingOrders();
  const [acceptedToday, setAcceptedToday] = useState(0);
  const [rejectedToday, setRejectedToday] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Tick clock every 15s for live timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Pull today's accepted/rejected counts from customer_orders status
  useEffect(() => {
    if (!hotelId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (async () => {
      const { data } = await supabase
        .from("customer_orders")
        .select("status")
        .eq("hotel_id", hotelId)
        .gte("created_at", today.toISOString());
      const list = data || [];
      setAcceptedToday(list.filter((o) => o.status === "confirmed" || o.status === "billed").length);
      setRejectedToday(list.filter((o) => o.status === "rejected" || o.status === "cancelled").length);
    })();
  }, [hotelId, incomingOrders.length]);

  const waitingCount = incomingOrders.length;

  const handleAccept = (order: typeof incomingOrders[number]) => {
    dismissOrder(order.id);
    stopTitleFlash();
    toast.success(`Order from Table ${order.table_number} accepted`);
  };

  const handleReject = (order: typeof incomingOrders[number]) => {
    dismissOrder(order.id);
    stopTitleFlash();
    toast.error(`Order from Table ${order.table_number} rejected`);
  };

  if (!hotelId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto animate-pop-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-[20px] font-bold flex items-center gap-2 text-foreground">
            <span className="h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/30 flex items-center justify-center">
              <Bell className="h-4 w-4 text-primary" />
            </span>
            Incoming Customer Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Live QR orders waiting for confirmation
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill
          label="Waiting"
          value={waitingCount}
          icon={Clock}
          accent="text-amber-400 bg-amber-500/15 ring-amber-500/30"
        />
        <StatPill
          label="Accepted Today"
          value={acceptedToday}
          icon={CheckCircle2}
          accent="text-emerald-400 bg-emerald-500/15 ring-emerald-500/30"
        />
        <StatPill
          label="Rejected Today"
          value={rejectedToday}
          icon={XCircle}
          accent="text-rose-400 bg-rose-500/15 ring-rose-500/30"
        />
      </div>

      {incomingOrders.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center animate-pop-in">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-inset ring-primary/20">
            <QrCode className="h-10 w-10 text-primary/70" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Waiting for QR orders</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
            Customers scan the table QR code to browse the menu and place orders. New orders appear here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {incomingOrders.map((order) => {
            const ageMin = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
            const urgent = ageMin >= 5;
            return (
              <div
                key={order.id}
                className={`relative rounded-2xl overflow-hidden border bg-card transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.35)] animate-pop-in ${
                  urgent ? "border-rose-500/50" : "border-primary/40"
                }`}
              >
                {/* Top stripe */}
                <div className={`h-1 w-full ${urgent ? "bg-rose-500" : "bg-primary"}`} />
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/30 flex items-center justify-center">
                        <span className="text-sm font-extrabold text-primary tnum">T{order.table_number}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Table {order.table_number}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 tnum">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        urgent
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse"
                          : "bg-primary/15 text-primary border border-primary/30"
                      }`}
                    >
                      {urgent ? `${ageMin}m WAIT` : "NEW"}
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                    {(order.items as any[])?.map((item: any, i: number) => (
                      <div key={i} className="flex items-start justify-between text-sm">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-muted-foreground tnum">×{item.quantity} · ₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-base font-extrabold text-foreground tnum">₹{order.total_amount}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50"
                        onClick={() => handleReject(order)}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleAccept(order)}
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function StatPill({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5 flex items-center gap-3 transition-all hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.2)]">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ring-inset ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold text-foreground tnum leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}

export default IncomingOrders;
