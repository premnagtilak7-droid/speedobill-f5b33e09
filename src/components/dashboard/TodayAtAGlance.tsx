import { useEffect, useState, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Flame, Trophy, CreditCard, Users } from "lucide-react";

interface Props {
  hotelId: string;
}

interface Glance {
  peakHour: string;
  topItem: { name: string; count: number } | null;
  cashPct: number;
  upiPct: number;
  cardPct: number;
  staffOnDuty: number;
}

const TodayAtAGlance = forwardRef<HTMLDivElement, Props>(({ hotelId }, _ref) => {
  const [data, setData] = useState<Glance>({
    peakHour: "—",
    topItem: null,
    cashPct: 0,
    upiPct: 0,
    cardPct: 0,
    staffOnDuty: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    const load = async () => {
      const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const today = istNow.toISOString().split("T")[0];
      const startIso = `${today}T00:00:00`;
      const endIso = `${today}T23:59:59.999`;

      const [billsRes, attendanceRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, created_at, total, payment_method")
          .eq("hotel_id", hotelId)
          .eq("status", "billed")
          .gte("created_at", startIso)
          .lte("created_at", endIso),
        supabase
          .from("attendance_logs")
          .select("user_id, action, created_at")
          .eq("hotel_id", hotelId)
          .gte("created_at", startIso)
          .lte("created_at", endIso)
          .order("created_at", { ascending: true }),
      ]);

      const bills = billsRes.data || [];

      // Peak hour by bill count
      const hourBuckets: Record<number, number> = {};
      bills.forEach((b) => {
        const h = new Date(b.created_at).getHours();
        hourBuckets[h] = (hourBuckets[h] || 0) + 1;
      });
      let peakHour = "—";
      const sortedH = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1]);
      if (sortedH.length > 0) {
        const h = parseInt(sortedH[0][0]);
        const fmt = (x: number) => {
          const ampm = x >= 12 ? "PM" : "AM";
          const hh = x % 12 === 0 ? 12 : x % 12;
          return `${hh}${ampm}`;
        };
        peakHour = `${fmt(h)}–${fmt(h + 1)}`;
      }

      // Payment split (excludes complimentary, splits counted to all 3 methods proportionally)
      let cash = 0, upi = 0, card = 0;
      bills.forEach((b) => {
        const pm = (b.payment_method || "").toLowerCase();
        const total = Number(b.total);
        if (pm === "complimentary") return;
        if (pm.startsWith("split:")) {
          // payment_method like "split:cash=50,upi=100,card=0"
          const parts = pm.replace("split:", "").split(",");
          parts.forEach((p) => {
            const [k, v] = p.split("=");
            const val = parseFloat(v) || 0;
            if (k === "cash") cash += val;
            else if (k === "upi") upi += val;
            else if (k === "card") card += val;
          });
        } else if (pm === "cash") cash += total;
        else if (pm === "upi") upi += total;
        else if (pm === "card") card += total;
        else cash += total; // fallback
      });
      const totalPm = cash + upi + card;
      const pct = (n: number) => (totalPm > 0 ? Math.round((n / totalPm) * 100) : 0);

      // Top selling item today — query order_items joined to billed orders
      const billIds = bills.map((b) => b.id);
      let topItem: { name: string; count: number } | null = null;
      if (billIds.length > 0) {
        const { data: itemRows } = await supabase
          .from("order_items")
          .select("name, quantity, order_id")
          .in("order_id", billIds);
        const itemMap: Record<string, number> = {};
        (itemRows || []).forEach((i) => {
          itemMap[i.name] = (itemMap[i.name] || 0) + Number(i.quantity);
        });
        const sorted = Object.entries(itemMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) topItem = { name: sorted[0][0], count: sorted[0][1] };
      }

      // Staff on duty: distinct user_ids whose latest action today is clock_in
      const latestByUser: Record<string, string> = {};
      (attendanceRes.data || []).forEach((a) => {
        latestByUser[a.user_id] = a.action;
      });
      const onDuty = Object.values(latestByUser).filter((act) => act === "clock_in").length;

      setData({
        peakHour,
        topItem,
        cashPct: pct(cash),
        upiPct: pct(upi),
        cardPct: pct(card),
        staffOnDuty: onDuty,
      });
      setLoading(false);
    };

    load();
    const channel = supabase
      .channel("dashboard-glance")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs", filter: `hotel_id=eq.${hotelId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId]);

  return (
    <div
      className="rounded-xl p-4 animate-pop-in glass-card"
      style={{ border: "1px solid hsl(var(--border) / 0.5)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30">
          <Sparkles size={15} />
        </div>
        <span className="text-sm font-semibold text-foreground">Today at a Glance</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Peak hour */}
          <div className="rounded-lg p-3 bg-rose-500/8 border border-rose-500/15">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Flame size={12} className="text-rose-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Busiest</span>
            </div>
            <p className="text-lg font-extrabold text-foreground tnum leading-none">{data.peakHour}</p>
            <p className="text-[10px] text-muted-foreground mt-1">peak hour today</p>
          </div>

          {/* Top item */}
          <div className="rounded-lg p-3 bg-emerald-500/8 border border-emerald-500/15">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Trophy size={12} className="text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top item</span>
            </div>
            <p className="text-sm font-extrabold text-foreground leading-tight truncate" title={data.topItem?.name}>
              {data.topItem?.name || "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {data.topItem ? `${data.topItem.count} sold` : "no sales yet"}
            </p>
          </div>

          {/* Payment split */}
          <div className="rounded-lg p-3 bg-sky-500/8 border border-sky-500/15">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CreditCard size={12} className="text-sky-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pay split</span>
            </div>
            <div className="text-[11px] font-semibold text-foreground space-y-0.5">
              <div className="flex items-center justify-between"><span>Cash</span><span className="tnum">{data.cashPct}%</span></div>
              <div className="flex items-center justify-between"><span>UPI</span><span className="tnum">{data.upiPct}%</span></div>
              <div className="flex items-center justify-between"><span>Card</span><span className="tnum">{data.cardPct}%</span></div>
            </div>
          </div>

          {/* Staff on duty */}
          <div className="rounded-lg p-3 bg-violet-500/8 border border-violet-500/15">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users size={12} className="text-violet-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">On duty</span>
            </div>
            <p className="text-2xl font-extrabold text-foreground tnum leading-none">{data.staffOnDuty}</p>
            <p className="text-[10px] text-muted-foreground mt-1">staff clocked in</p>
          </div>
        </div>
      )}
    </div>
  );
});

TodayAtAGlance.displayName = "TodayAtAGlance";

export default TodayAtAGlance;
