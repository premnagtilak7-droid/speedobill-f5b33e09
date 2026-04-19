import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ShoppingBag, Receipt, UserCircle, Package, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  icon: typeof Activity;
  iconColor: string;
  text: string;
  ts: string;
  isNew?: boolean;
};

interface Props {
  hotelId: string;
}

const RecentActivityFeed = ({ hotelId }: Props) => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [ordersRes, billedRes, attendanceRes, ingsRes] = await Promise.all([
      // New orders placed (active status, last 24h)
      supabase
        .from("orders")
        .select("id, table_id, created_at, status, total")
        .eq("hotel_id", hotelId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(25),
      // Bills settled (billed_at)
      supabase
        .from("orders")
        .select("id, total, billed_at")
        .eq("hotel_id", hotelId)
        .eq("status", "billed")
        .gte("billed_at", since)
        .order("billed_at", { ascending: false })
        .limit(15),
      // Staff clock-in/out
      supabase
        .from("attendance_logs")
        .select("id, full_name, action, created_at")
        .eq("hotel_id", hotelId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10),
      // Low-stock ingredients (snapshot, no timestamp — show as latest)
      supabase
        .from("ingredients")
        .select("id, name, current_stock, min_threshold, created_at")
        .eq("hotel_id", hotelId),
    ]);

    // Map table_id -> table_number for friendlier text
    const tableIds = Array.from(new Set((ordersRes.data || []).map((o) => o.table_id).filter(Boolean)));
    let tableMap: Record<string, number> = {};
    if (tableIds.length > 0) {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id, table_number")
        .in("id", tableIds);
      (data || []).forEach((t) => { tableMap[t.id] = t.table_number; });
    }

    const feed: ActivityItem[] = [];

    (ordersRes.data || []).forEach((o) => {
      const tn = tableMap[o.table_id as string];
      feed.push({
        id: `order-${o.id}`,
        icon: ShoppingBag,
        iconColor: "text-sky-400 bg-sky-500/15",
        text: tn ? `🍽️ Table ${tn} — order placed` : `🍽️ New order placed`,
        ts: o.created_at,
      });
    });

    (billedRes.data || []).forEach((o) => {
      if (!o.billed_at) return;
      feed.push({
        id: `bill-${o.id}`,
        icon: Receipt,
        iconColor: "text-emerald-400 bg-emerald-500/15",
        text: `💰 Bill paid · ₹${Number(o.total).toFixed(0)}`,
        ts: o.billed_at,
      });
    });

    (attendanceRes.data || []).forEach((a) => {
      const verb = a.action === "clock_out" ? "clocked out" : "logged in";
      feed.push({
        id: `att-${a.id}`,
        icon: UserCircle,
        iconColor: "text-violet-400 bg-violet-500/15",
        text: `👤 ${a.full_name || "Staff"} ${verb}`,
        ts: a.created_at,
      });
    });

    // Low stock alerts — synthetic timestamp = now (we want them present)
    (ingsRes.data || [])
      .filter((i) => i.min_threshold > 0 && Number(i.current_stock) <= Number(i.min_threshold))
      .slice(0, 4)
      .forEach((i) => {
        feed.push({
          id: `lowstock-${i.id}`,
          icon: Package,
          iconColor: "text-amber-400 bg-amber-500/15",
          text: `📦 Low stock: ${i.name} (${i.current_stock} left)`,
          ts: i.created_at || new Date().toISOString(),
        });
      });

    feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const top = feed.slice(0, 10);

    // Mark items not seen before as new
    setItems((prev) => {
      const prevIds = new Set(prev.map((p) => p.id));
      return top.map((it) => ({
        ...it,
        isNew: prev.length > 0 && !prevIds.has(it.id) && !seenIds.has(it.id),
      }));
    });
    setLoading(false);
  }, [hotelId, seenIds]);

  useEffect(() => {
    if (!hotelId) return;
    loadFeed();

    const channel = supabase
      .channel("dashboard-activity-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => loadFeed())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs", filter: `hotel_id=eq.${hotelId}` }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients", filter: `hotel_id=eq.${hotelId}` }, () => loadFeed())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, loadFeed]);

  // Mark visible items as seen after 5s so the "new" dot fades on next refresh
  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => {
      setSeenIds((prev) => {
        const next = new Set(prev);
        items.forEach((i) => next.add(i.id));
        return next;
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [items]);

  return (
    <div
      className="rounded-xl p-4 animate-pop-in glass-card"
      style={{ border: "1px solid hsl(var(--border) / 0.5)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
          <Activity size={15} />
        </div>
        <span className="text-sm font-semibold text-foreground">Recent Activity</span>
        <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">Live · last 24h</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">No activity yet today</p>
      ) : (
        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className={`relative h-8 w-8 rounded-full flex items-center justify-center ${it.iconColor} shrink-0`}>
                  <Icon size={14} />
                  {it.isNew && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground truncate">{it.text}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 tnum">
                  {formatDistanceToNow(new Date(it.ts), { addSuffix: true })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentActivityFeed;
