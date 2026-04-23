import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  IndianRupee, ShoppingBag, Grid3X3, AlertTriangle,
  Plus, UtensilsCrossed, BarChart3, Wallet, ChefHat, Clock, Crown,
  TrendingUp, TrendingDown, Bell, Check as CheckIcon, Package, Flame, Receipt, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useIncomingOrders } from "@/hooks/useIncomingOrders";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RestaurantIllustration from "@/components/dashboard/RestaurantIllustration";
import LowStockMiniChart from "@/components/dashboard/LowStockMiniChart";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import QuickBillSearch from "@/components/dashboard/QuickBillSearch";
import TodayAtAGlance from "@/components/dashboard/TodayAtAGlance";
import BirthdayAlerts from "@/components/dashboard/BirthdayAlerts";

interface LowStockItem {
  name: string;
  current_stock: number;
  min_stock: number;
}

interface LowStockIngredient {
  name: string;
  current_stock: number;
  min_threshold: number;
  unit: string;
}

interface CounterWaiterStat {
  name: string;
  total: number;
  bills: number;
}

// Per-label accent: { ringColor, iconBg, iconText, glow }
// Falls back to "primary" (orange) for anything not mapped.
const accentByLabel: Record<string, { ring: string; bg: string; text: string; shadow: string }> = {
  "Today's Sale":         { ring: "from-primary/60",   bg: "bg-primary/15",      text: "text-primary",      shadow: "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]" },
  "Counter Sales":        { ring: "from-primary/60",   bg: "bg-primary/15",      text: "text-primary",      shadow: "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]" },
  "Top Counter Waiter":   { ring: "from-violet-500/60",bg: "bg-violet-500/15",   text: "text-violet-400",   shadow: "shadow-[0_0_20px_-4px_hsl(263_70%_58%/0.6)]" },
  "Total Revenue":        { ring: "from-primary/60",   bg: "bg-primary/15",      text: "text-primary",      shadow: "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]" },
  "Orders Today":         { ring: "from-sky-500/60",   bg: "bg-sky-500/15",      text: "text-sky-400",      shadow: "shadow-[0_0_20px_-4px_hsl(217_91%_60%/0.6)]" },
  "Active Tables":        { ring: "from-emerald-500/60",bg: "bg-emerald-500/15", text: "text-emerald-400",  shadow: "shadow-[0_0_20px_-4px_hsl(142_71%_45%/0.6)]" },
  "Pending KOT":          { ring: "from-rose-500/60",  bg: "bg-rose-500/15",     text: "text-rose-400",     shadow: "shadow-[0_0_20px_-4px_hsl(0_72%_51%/0.6)]" },
  "Incoming Orders":      { ring: "from-amber-500/60", bg: "bg-amber-500/15",    text: "text-amber-400",    shadow: "shadow-[0_0_20px_-4px_hsl(38_92%_50%/0.6)]" },
  "Bills Pending 45m+":   { ring: "from-rose-500/60",  bg: "bg-rose-500/15",     text: "text-rose-400",     shadow: "shadow-[0_0_20px_-4px_hsl(0_72%_51%/0.6)]" },
  "Avg Turnover":         { ring: "from-teal-500/60",  bg: "bg-teal-500/15",     text: "text-teal-400",     shadow: "shadow-[0_0_20px_-4px_hsl(168_76%_42%/0.6)]" },
  "No-Shows (7d)":        { ring: "from-rose-500/60",  bg: "bg-rose-500/15",     text: "text-rose-400",     shadow: "shadow-[0_0_20px_-4px_hsl(0_72%_51%/0.6)]" },
};
const defaultAccent = { ring: "from-primary/60", bg: "bg-primary/15", text: "text-primary", shadow: "shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]" };

const Dashboard = () => {
  const { role, hotelId, user } = useAuth();
  const navigate = useNavigate();
  const { incomingCount } = useIncomingOrders();
  const { status: subStatus, daysLeft, plan: subPlan, expiresAt } = useSubscription();
  const [ownerName, setOwnerName] = useState<string>("");
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [activeTables, setActiveTables] = useState(0);
  const [totalTables, setTotalTables] = useState(0);
  const [pendingKOT, setPendingKOT] = useState(0);
  const [stuckBillsCount, setStuckBillsCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [tableTurnover, setTableTurnover] = useState<string>("—");
  const [noShows, setNoShows] = useState(0);
  const [lowStockIngredients, setLowStockIngredients] = useState<LowStockIngredient[]>([]);
  const [totalIngredients, setTotalIngredients] = useState(0);
  const [wastageCount30d, setWastageCount30d] = useState(0);
  const [counterSalesToday, setCounterSalesToday] = useState(0);
  const [counterBillsToday, setCounterBillsToday] = useState(0);
  const [topCounterWaiter, setTopCounterWaiter] = useState<CounterWaiterStat | null>(null);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [codeCopied, setCodeCopied] = useState(false);

  // Fetch logged-in user's display name from profiles
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("full_name, email").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const fallback = user.email ? user.email.split("@")[0] : "";
        const name = (data?.full_name || "").trim() || fallback;
        // Use just the first name for a friendly greeting
        const first = name.split(/\s+/)[0];
        if (first) setOwnerName(first.charAt(0).toUpperCase() + first.slice(1));
      });
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!hotelId) return;
    const fetchStats = async () => {
      const now = new Date();
      const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const today = istDate.toISOString().split("T")[0];
      const [salesRes, ordersRes, tablesRes, menuRes, kotRes, hotelRes, totalRevenueRes, ingredientsRes, counterRes] = await Promise.all([
        supabase.from("sales").select("amount").eq("hotel_id", hotelId).eq("sale_date", today),
        supabase.from("orders").select("id").eq("hotel_id", hotelId).eq("status", "billed").gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59.999`),
        supabase.from("restaurant_tables").select("id, status").eq("hotel_id", hotelId),
        supabase.from("menu_items").select("name, current_stock, min_stock").eq("hotel_id", hotelId),
        supabase.from("kot_tickets").select("id").eq("hotel_id", hotelId).eq("status", "pending"),
        supabase.from("hotels").select("subscription_tier, subscription_expiry, hotel_code, name").eq("id", hotelId).maybeSingle(),
        supabase.from("orders").select("total").eq("hotel_id", hotelId).eq("status", "billed"),
        supabase.from("ingredients").select("name, current_stock, min_threshold, unit").eq("hotel_id", hotelId),
        supabase
          .from("counter_orders")
          .select("waiter_id, waiter_name, total_amount, created_at")
          .eq("hotel_id", hotelId)
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59.999`),
      ]);
      if (salesRes.data) setTodayEarnings(salesRes.data.reduce((sum, s) => sum + Number(s.amount), 0));
      if (ordersRes.data) setTotalOrders(ordersRes.data.length);
      if (tablesRes.data) {
        setTotalTables(tablesRes.data.length);
        setActiveTables(tablesRes.data.filter((t) => t.status === "occupied").length);
      }
      if (menuRes.data) {
        const low = (menuRes.data as LowStockItem[]).filter(
          (item) => item.min_stock > 0 && item.current_stock <= item.min_stock
        );
        setLowStockItems(low);
      }
      if (kotRes.data) setPendingKOT(kotRes.data.length);
      if (hotelRes.data) {
        setHotelCode((hotelRes.data as any).hotel_code || "");
        setHotelName((hotelRes.data as any).name || "");
      }
      // Stuck bills: active orders open >45m
      const cutoff45 = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const { data: stuckRows } = await supabase
        .from("orders").select("id").eq("hotel_id", hotelId).eq("status", "active").lt("created_at", cutoff45);
      setStuckBillsCount((stuckRows || []).length);
      if (totalRevenueRes.data) setTotalRevenue(totalRevenueRes.data.reduce((sum, o) => sum + Number(o.total), 0));
      if (ingredientsRes.data) {
        const allIngs = ingredientsRes.data as LowStockIngredient[];
        setTotalIngredients(allIngs.length);
        const lowIng = allIngs.filter(i => i.min_threshold > 0 && i.current_stock <= i.min_threshold);
        setLowStockIngredients(lowIng);
      }
      if (counterRes.data) {
        const waiterMap = new Map<string, CounterWaiterStat>();
        const totalCounter = counterRes.data.reduce((sum, order) => {
          const amount = Number(order.total_amount);
          const waiterKey = order.waiter_id || order.waiter_name || "unknown";
          const current = waiterMap.get(waiterKey) ?? { name: order.waiter_name || "Staff", total: 0, bills: 0 };
          waiterMap.set(waiterKey, {
            name: current.name,
            total: current.total + amount,
            bills: current.bills + 1,
          });
          return sum + amount;
        }, 0);
        setCounterSalesToday(totalCounter);
        setCounterBillsToday(counterRes.data.length);
        const topWaiter = Array.from(waiterMap.values()).sort((a, b) => b.total - a.total)[0] ?? null;
        setTopCounterWaiter(topWaiter);
      } else {
        setCounterSalesToday(0);
        setCounterBillsToday(0);
        setTopCounterWaiter(null);
      }

      if (role === "owner") {
        const thirtyAgo = new Date();
        thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        const wRes = await supabase.from("wastage_logs").select("id", { count: "exact", head: true })
          .eq("hotel_id", hotelId).gte("created_at", thirtyAgo.toISOString());
        setWastageCount30d(wRes.count || 0);
      }

      const billedToday = await supabase
        .from("orders")
        .select("created_at, billed_at")
        .eq("hotel_id", hotelId)
        .eq("status", "billed")
        .gte("created_at", `${today}T00:00:00`)
        .not("billed_at", "is", null);
      if (billedToday.data && billedToday.data.length > 0) {
        const avgMs = billedToday.data.reduce((sum, o) => {
          const diff = new Date(o.billed_at!).getTime() - new Date(o.created_at).getTime();
          return sum + diff;
        }, 0) / billedToday.data.length;
        const avgMin = Math.round(avgMs / 60000);
        setTableTurnover(avgMin < 60 ? `${avgMin}m` : `${Math.floor(avgMin / 60)}h ${avgMin % 60}m`);
      } else {
        setTableTurnover("—");
      }

      const weekAgo = new Date(istDate);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const noShowRes = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("status", "no-show")
        .gte("reservation_time", weekAgo.toISOString());
      setNoShows(noShowRes.count || 0);
    };
    fetchStats();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_tickets" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "counter_orders" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, role]);

  const userName = ownerName || "there";

  const quickStats = [
    { label: "Today's Sale", value: `₹${todayEarnings.toFixed(0)}`, icon: IndianRupee, trend: "+12%" as string | null, up: true },
    { label: "Counter Sales", value: `₹${counterSalesToday.toFixed(0)}`, icon: Receipt, trend: counterBillsToday > 0 ? `${counterBillsToday} bills` : null, up: true },
    { label: "Top Counter Waiter", value: topCounterWaiter?.name ?? "—", icon: Users, trend: topCounterWaiter ? `₹${topCounterWaiter.total.toFixed(0)}` : null, up: true },
    { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, icon: IndianRupee, trend: null, up: true },
    { label: "Active Tables", value: `${activeTables}/${totalTables}`, icon: Grid3X3, trend: null, up: true },
    { label: "Pending KOT", value: String(pendingKOT), icon: Clock, trend: null, up: false },
    { label: "Orders Today", value: String(totalOrders), icon: ShoppingBag, trend: null, up: true },
    ...(incomingCount > 0 ? [{ label: "Incoming Orders", value: String(incomingCount), icon: Bell, trend: "NEW" as string | null, up: true }] : []),
    ...(stuckBillsCount > 0 ? [{ label: "Bills Pending 45m+", value: String(stuckBillsCount), icon: AlertTriangle, trend: "URGENT" as string | null, up: false }] : []),
    ...(role === "owner" ? [
      { label: "Avg Turnover", value: tableTurnover, icon: Clock, trend: null, up: true },
      { label: "No-Shows (7d)", value: String(noShows), icon: AlertTriangle, trend: null, up: false },
    ] : []),
  ];

  const actionCards = [
    { label: "New Order", desc: "Start a new table order", icon: Plus, gradient: "gradient-bar-violet", to: "/tables" },
    { label: "Table Map", desc: "View all tables", icon: Grid3X3, gradient: "gradient-bar-emerald", to: "/tables" },
    { label: "Menu", desc: "Manage menu items", icon: UtensilsCrossed, gradient: "gradient-bar-cyan", to: "/menu" },
    { label: "Kitchen", desc: "Kitchen display", icon: ChefHat, gradient: "gradient-bar-amber", to: "/kitchen" },
    { label: "Expenses", desc: "Track daily costs", icon: Wallet, gradient: "gradient-bar-teal", to: "/expenses" },
    { label: "Reports", desc: "Analytics & insights", icon: BarChart3, gradient: "gradient-bar-rose", to: "/analytics" },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Welcome banner — gradient navy card with orange left rail + restaurant illustration */}
      <div className="relative overflow-hidden rounded-2xl animate-pop-in shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]">
        {/* Orange left accent rail */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
        {/* Gradient background */}
        <div
          className="relative px-5 md:px-7 py-5 md:py-6"
          style={{
            background:
              "linear-gradient(135deg, hsl(222 39% 16%) 0%, hsl(240 33% 10%) 100%)",
            border: "1px solid hsl(var(--primary) / 0.18)",
          }}
        >
          {/* Soft orange glow */}
          <div
            className="absolute -top-16 -right-10 w-[260px] h-[260px] pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)" }}
          />
          {/* Decorative SVG */}
          <RestaurantIllustration className="hidden sm:block absolute right-3 bottom-0 h-[140px] w-auto opacity-90 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-[24px] font-bold text-white tracking-tight">
                Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {userName} 👋
              </h1>
              <p className="text-[13px] text-white/60 mt-1">
                Here's what's happening at your restaurant today
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(() => {
                  const planLabel =
                    subStatus === "trial"
                      ? "Free Trial"
                      : subPlan
                      ? subPlan.charAt(0).toUpperCase() + subPlan.slice(1) + " Plan"
                      : "Free Plan";
                  const tone =
                    subStatus === "trial"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : subPlan === "premium"
                      ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                      : subPlan === "basic"
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-white/5 text-white/60 border-white/10";
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tone}`}>
                      <Crown className="h-3 w-3" />
                      {planLabel}
                      {subStatus === "trial" && daysLeft !== null && ` · ${daysLeft}d left`}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-white tnum leading-none">{timeStr}</p>
              <p className="text-[11px] text-white/50 mt-1.5">{dateStr}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Bill Search */}
      {hotelId && <QuickBillSearch hotelId={hotelId} />}
      {(() => {
        const formattedExpiry = expiresAt
          ? new Date(expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : null;
        const expiringWithin3 = subStatus === "active" && daysLeft !== null && daysLeft <= 3;

        if (subStatus === "active" && subPlan === "premium") {
          return (
            <div className="rounded-xl p-4 animate-pop-in"
              style={{ background: "hsl(var(--card))", border: `1px solid ${expiringWithin3 ? "rgba(245,158,11,0.3)" : "rgba(124,58,237,0.2)"}` }}
            >
              <div className="flex items-center gap-3 mb-2">
                {expiringWithin3
                  ? <AlertTriangle className="h-5 w-5" style={{ color: "#F59E0B" }} />
                  : <Crown className="h-5 w-5" style={{ color: "#7C3AED" }} />
                }
                <Badge style={{ background: "rgba(124,58,237,0.15)", color: "#7C3AED", border: "none" }}>Premium Plan</Badge>
              </div>
              {expiringWithin3 ? (
                <>
                  <p className="text-sm text-foreground font-medium">Renews in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
                  <Button size="sm" className="mt-2 font-bold text-xs text-white" style={{ background: "#F59E0B" }}
                    onClick={() => navigate("/settings")}>Renew Now</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Active until {formattedExpiry}</p>
              )}
            </div>
          );
        }

        if (subStatus === "active" && subPlan === "basic") {
          return (
            <div className="rounded-xl p-4 animate-pop-in"
              style={{ background: "hsl(var(--card))", border: `1px solid ${expiringWithin3 ? "rgba(245,158,11,0.3)" : "rgba(6,182,212,0.2)"}` }}
            >
              <div className="flex items-center gap-3 mb-2">
                {expiringWithin3
                  ? <AlertTriangle className="h-5 w-5" style={{ color: "#F59E0B" }} />
                  : <CheckIcon className="h-5 w-5" style={{ color: "#22C55E" }} />
                }
                <Badge style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4", border: "none" }}>Basic Plan</Badge>
              </div>
              {expiringWithin3 ? (
                <>
                  <p className="text-sm text-foreground font-medium">Renews in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
                  <Button size="sm" className="mt-2 font-bold text-xs text-white" style={{ background: "#F59E0B" }}
                    onClick={() => navigate("/settings")}>Renew Now</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Active until {formattedExpiry}</p>
                  <Button size="sm" variant="ghost" className="mt-2 text-xs" style={{ color: "#7C3AED" }}
                    onClick={() => navigate("/settings")}>Upgrade to Premium →</Button>
                </>
              )}
            </div>
          );
        }

        if (subStatus === "trial") {
          const dayUsed = daysLeft !== null ? 7 - daysLeft : 0;
          return (
            <div className="rounded-xl p-4 animate-pop-in"
              style={{ background: "hsl(var(--card))", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Crown className="h-5 w-5" style={{ color: "#F59E0B" }} />
                <Badge style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "none" }}>Free Trial</Badge>
              </div>
              <p className="text-3xl font-bold text-foreground mb-1">{daysLeft} <span className="text-sm font-normal text-muted-foreground">days remaining</span></p>
              <Progress value={(dayUsed / 7) * 100} className="h-1.5 mb-3" />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" className="text-white font-bold text-xs" style={{ background: "#06B6D4" }}
                  onClick={() => navigate("/settings")}>Basic ₹199/mo</Button>
                <Button size="sm" className="text-white font-bold text-xs" style={{ background: "linear-gradient(135deg, #7C3AED, #6366F1)" }}
                  onClick={() => navigate("/settings")}>Premium ₹499/mo</Button>
              </div>
            </div>
          );
        }

        if (subStatus === "free") {
          return (
            <div className="rounded-xl p-4 animate-pop-in"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Crown className="h-5 w-5 text-muted-foreground" />
                <Badge variant="secondary">Free Version</Badge>
              </div>
              <p className="text-sm text-muted-foreground">You're on the free plan with limited features.</p>
              <Button size="sm" className="mt-2 font-bold text-xs text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #6366F1)" }}
                onClick={() => navigate("/pricing")}>Upgrade Now</Button>
            </div>
          );
        }

        return null;
      })()}

      {/* Metric Cards — gradient top border, accent icon circle, big numeric, hover lift */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {quickStats.map((stat, i) => {
          const a = accentByLabel[stat.label] ?? defaultAccent;
          return (
            <div
              key={stat.label}
              className={`group relative rounded-xl overflow-hidden animate-pop-in glass-card transition-all duration-200 hover:-translate-y-[3px] hover:${a.shadow}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Top gradient border (accent → transparent) */}
              <div className={`h-[3px] w-full bg-gradient-to-r ${a.ring} to-transparent`} />
              <div className="px-4 py-3.5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${a.bg} ${a.text} ring-1 ring-inset ring-current/20 transition-shadow duration-200 group-hover:${a.shadow}`}
                  >
                    <stat.icon size={18} strokeWidth={2.25} />
                  </div>
                  {stat.trend && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        stat.up
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {stat.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {stat.trend}
                    </span>
                  )}
                </div>
                <p className="text-[26px] md:text-[30px] font-extrabold text-foreground tnum leading-none tracking-tight">
                  {stat.value}
                </p>
                <p className="label-caps text-[10px] mt-2 tracking-wider">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today at a Glance */}
      {hotelId && <TodayAtAGlance hotelId={hotelId} />}

      {/* Birthday Alerts (only renders if there are upcoming birthdays) */}
      {hotelId && role === "owner" && <BirthdayAlerts hotelId={hotelId} />}


      {role === "owner" && lowStockItems.length > 0 && (
        <div className="rounded-xl p-4 animate-pop-in"
          style={{ background: "hsl(var(--card))", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold">Low Stock Alert</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <Badge key={item.name} variant="outline" className="text-warning border-warning/30 gap-1 text-xs">
                {item.name}: {item.current_stock}/{item.min_stock}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ingredient Low Stock */}
      {role === "owner" && lowStockIngredients.length > 0 && (
        <div className="rounded-xl p-4 animate-pop-in cursor-pointer"
          style={{ background: "hsl(var(--card))", border: "1px solid rgba(239,68,68,0.2)" }}
          onClick={() => navigate("/inventory")}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold">Ingredient Low Stock</span>
            <Badge className="text-[9px] ml-auto" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "none" }}>{lowStockIngredients.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockIngredients.map((item) => (
              <Badge key={item.name} variant="outline" className="text-destructive border-destructive/30 gap-1 text-xs">
                {item.name}: {item.current_stock}/{item.min_threshold} {item.unit}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Overview — with mini bar chart of top 5 low-stock ingredients */}
      {role === "owner" && (
        <div
          className="rounded-xl p-4 animate-pop-in cursor-pointer glass-card hover:-translate-y-[2px] transition-transform"
          onClick={() => navigate("/stock-analytics")}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
              <Package size={15} />
            </div>
            <span className="text-sm font-semibold text-foreground">Inventory Overview</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Tap for details →</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xl font-extrabold text-foreground tnum leading-none">{totalIngredients}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Ingredients</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-warning tnum leading-none">{lowStockIngredients.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Low Stock</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-destructive tnum leading-none">{wastageCount30d}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Wastage (30d)</p>
            </div>
          </div>

          {lowStockIngredients.length > 0 ? (
            <>
              <p className="mt-4 mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Top 5 Low Stock
              </p>
              <LowStockMiniChart items={lowStockIngredients} />
            </>
          ) : (
            <p className="mt-4 text-[11px] text-muted-foreground text-center py-2">
              All ingredients above minimum threshold ✓
            </p>
          )}
        </div>
      )}

      {/* Quick Actions — larger cards, gradient backgrounds, scale on hover */}
      <div>
        <h2 className="text-[11px] font-bold mb-3 text-muted-foreground uppercase tracking-widest">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {actionCards.map((card, i) => {
            const isPrimary = card.label === "New Order";
            return (
              <button
                key={card.label}
                onClick={() => navigate(card.to)}
                className={`group relative rounded-2xl p-4 text-left animate-pop-in btn-press overflow-hidden transition-all duration-200 hover:scale-[1.05] hover:shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.4)] ${
                  isPrimary
                    ? "sm:col-span-1 md:col-span-1 ring-2 ring-primary/40"
                    : ""
                }`}
                style={{
                  animationDelay: `${(i + 5) * 40}ms`,
                  background: isPrimary
                    ? "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))"
                    : "linear-gradient(135deg, hsl(var(--card) / 0.95), hsl(var(--card) / 0.6))",
                  border: isPrimary
                    ? "1px solid hsl(var(--primary) / 0.4)"
                    : "1px solid hsl(var(--border) / 0.4)",
                }}
              >
                <div
                  className={`h-12 w-12 rounded-xl flex items-center justify-center ${card.gradient} mb-3 shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-4deg]`}
                >
                  <card.icon size={24} className="text-white" strokeWidth={2.25} />
                </div>
                <p className={`font-bold text-foreground leading-tight ${isPrimary ? "text-sm" : "text-[13px]"}`}>
                  {card.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden md:block">
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Feed */}
      {hotelId && <RecentActivityFeed hotelId={hotelId} />}
    </div>
  );
};

export default Dashboard;
