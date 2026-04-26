/**
 * Manager Dashboard — focused operational console.
 *
 * Differs from the Owner Dashboard by surfacing live floor + shift signals
 * the manager actually controls during a shift:
 *  - Today overview (orders, revenue, occupied tables, staff present, pending, ready)
 *  - Quick actions (jump to Tables / Orders / Discounts / Close Day)
 *  - Shift roster (who's clocked-in right now + clock in/out toggle)
 *  - Discounts applied today (manager + reason audit trail)
 *  - Recent voids / cancellations
 *
 * No financial-owner-only data (subscription, license, profit margin).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Activity, Users, Receipt, Grid3X3, AlertTriangle, ChefHat,
  ClipboardList, CalendarCheck, Percent, Clock, LogIn, LogOut,
  TrendingUp, Bell, ShoppingBag,
} from "lucide-react";
import { startOfDay, endOfDay, format, formatDistanceToNowStrict } from "date-fns";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function ManagerDashboard() {
  const { hotelId, user } = useAuth();
  const fullName = (user?.user_metadata as any)?.full_name as string | undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Tick the clock once a minute so "X minutes ago" stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { from, to } = useMemo(() => ({ from: startOfDay(now), to: endOfDay(now) }), [now]);

  // ─── TODAY OVERVIEW ───
  const overview = useQuery({
    queryKey: ["mgr-overview", hotelId, from.toDateString()],
    enabled: !!hotelId,
    queryFn: async () => {
      const fromISO = from.toISOString();
      const toISO = to.toISOString();
      const [ordersRes, tablesRes, attendanceRes, kotRes] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at").eq("hotel_id", hotelId!).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("restaurant_tables" as any).select("id, status").eq("hotel_id", hotelId!),
        supabase.from("attendance_logs").select("user_id, action, created_at, full_name").eq("hotel_id", hotelId!).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("kot_tickets").select("id, status").eq("hotel_id", hotelId!).gte("created_at", fromISO),
      ]);
      const orders = (ordersRes.data || []) as any[];
      const tables = (tablesRes.data || []) as any[];
      const attendance = (attendanceRes.data || []) as any[];
      const kots = (kotRes.data || []) as any[];

      const billed = orders.filter((o) => o.status === "billed");
      const pending = kots.filter((k) => k.status === "pending" || k.status === "preparing").length;
      const ready = kots.filter((k) => k.status === "ready").length;

      // Staff currently clocked in = last action per user is "clock_in"
      const lastAction = new Map<string, string>();
      attendance
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach((a) => lastAction.set(a.user_id, a.action));
      const onDuty = Array.from(lastAction.values()).filter((a) => a === "clock_in").length;

      return {
        totalOrders: billed.length,
        revenue: billed.reduce((s, o) => s + Number(o.total || 0), 0),
        tablesOccupied: tables.filter((t) => t.status === "occupied").length,
        tablesTotal: tables.length,
        staffOnDuty: onDuty,
        pending,
        ready,
        activeOrders: orders.filter((o) => o.status === "active").length,
      };
    },
    refetchInterval: 30_000,
  });

  // ─── SHIFT ROSTER ───
  const roster = useQuery({
    queryKey: ["mgr-roster", hotelId, from.toDateString()],
    enabled: !!hotelId,
    queryFn: async () => {
      const fromISO = from.toISOString();
      const toISO = to.toISOString();
      const [profilesRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("id, user_id, full_name, role").eq("hotel_id", hotelId!).eq("is_active", true),
        supabase.from("attendance_logs").select("user_id, action, created_at, full_name").eq("hotel_id", hotelId!).gte("created_at", fromISO).lte("created_at", toISO).order("created_at", { ascending: true }),
      ]);
      const staff = (profilesRes.data || []) as any[];
      const logs = (logsRes.data || []) as any[];

      return staff
        .filter((s) => s.role && s.role !== "owner")
        .map((s) => {
          const myLogs = logs.filter((l) => l.user_id === s.user_id);
          const last = myLogs[myLogs.length - 1];
          const onDuty = last?.action === "clock_in";
          // sum hours worked from pairs
          let workedMs = 0;
          let openIn: Date | null = null;
          myLogs.forEach((l) => {
            if (l.action === "clock_in") openIn = new Date(l.created_at);
            else if (l.action === "clock_out" && openIn) {
              workedMs += new Date(l.created_at).getTime() - openIn.getTime();
              openIn = null;
            }
          });
          if (openIn) workedMs += Date.now() - (openIn as Date).getTime();
          return {
            user_id: s.user_id,
            name: s.full_name || "Unknown",
            role: s.role,
            onDuty,
            sinceLabel: last ? formatDistanceToNowStrict(new Date(last.created_at), { addSuffix: true }) : "—",
            hoursToday: (workedMs / 3_600_000).toFixed(1),
          };
        })
        .sort((a, b) => Number(b.onDuty) - Number(a.onDuty));
    },
    refetchInterval: 60_000,
  });

  // ─── DISCOUNTS APPLIED TODAY (read from audit_logs where details starts with discount) ───
  const discounts = useQuery({
    queryKey: ["mgr-discounts", hotelId, from.toDateString()],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, details, performer_name, created_at, table_number")
        .eq("hotel_id", hotelId!)
        .ilike("action", "%discount%")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  // ─── RECENT VOIDS ───
  const voids = useQuery({
    queryKey: ["mgr-voids", hotelId, from.toDateString()],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, details, performer_name, created_at, table_number")
        .eq("hotel_id", hotelId!)
        .or("action.ilike.%void%,action.ilike.%cancel%")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  const clockToggle = async (userId: string, name: string, currentlyOn: boolean) => {
    if (!hotelId) return;
    const { error } = await supabase.from("attendance_logs").insert({
      hotel_id: hotelId,
      user_id: userId,
      full_name: name,
      action: currentlyOn ? "clock_out" : "clock_in",
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} ${currentlyOn ? "clocked out" : "clocked in"}`);
    qc.invalidateQueries({ queryKey: ["mgr-roster"] });
    qc.invalidateQueries({ queryKey: ["mgr-overview"] });
  };

  const o = overview.data;

  return (
    <div className="px-4 sm:px-6 py-5 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Manager Console</p>
          <h1 className="text-2xl sm:text-3xl font-black">
            Hi, {fullName?.split(" ")[0] || "Manager"} 👋
          </h1>
          <p className="text-xs text-muted-foreground">{format(now, "EEEE, dd MMM yyyy · h:mm a")}</p>
        </div>
        <Badge variant="outline" className="hidden sm:flex gap-1 text-xs"><Activity className="h-3 w-3" /> Live</Badge>
      </header>

      {/* Today Overview */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Today</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Orders" value={o ? String(o.totalOrders) : "—"} icon={Receipt} loading={overview.isLoading} />
          <StatCard label="Revenue" value={o ? fmtINR(o.revenue) : "—"} icon={TrendingUp} loading={overview.isLoading} accent="text-emerald-600" />
          <StatCard label="Tables Occupied" value={o ? `${o.tablesOccupied}/${o.tablesTotal}` : "—"} icon={Grid3X3} loading={overview.isLoading} />
          <StatCard label="Staff On Duty" value={o ? String(o.staffOnDuty) : "—"} icon={Users} loading={overview.isLoading} />
          <StatCard label="Active Orders" value={o ? String(o.activeOrders) : "—"} icon={ShoppingBag} loading={overview.isLoading} />
          <StatCard label="Pending KOTs" value={o ? String(o.pending) : "—"} icon={ChefHat} loading={overview.isLoading} accent="text-amber-600" />
          <StatCard label="Ready to Serve" value={o ? String(o.ready) : "—"} icon={Bell} loading={overview.isLoading} accent="text-emerald-600" />
          <StatCard label="Time" value={format(now, "h:mm a")} icon={Clock} loading={false} />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <ActionButton label="View Tables" icon={Grid3X3} onClick={() => navigate("/tables")} />
          <ActionButton label="Active Orders" icon={ShoppingBag} onClick={() => navigate("/my-orders")} />
          <ActionButton label="Incoming" icon={Bell} onClick={() => navigate("/incoming-orders")} />
          <ActionButton label="Kitchen" icon={ChefHat} onClick={() => navigate("/kds")} />
          <ActionButton label="Staff" icon={Users} onClick={() => navigate("/staff")} />
          <ActionButton label="Reports" icon={ClipboardList} onClick={() => navigate("/reports")} />
          <ActionButton label="Voids" icon={AlertTriangle} onClick={() => navigate("/void-reports")} accent="text-red-600" />
          <ActionButton label="Close Day" icon={CalendarCheck} onClick={() => navigate("/daily-closing")} accent="text-primary" />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Shift roster */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Shift Roster
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roster.isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (roster.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No staff in this hotel.</p>
            ) : (
              <ul className="space-y-2">
                {roster.data!.map((s) => (
                  <li key={s.user_id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.onDuty ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {s.role} · {s.hoursToday}h today · {s.sinceLabel}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={s.onDuty ? "outline" : "default"}
                      className="h-8 px-2.5 text-xs gap-1 shrink-0"
                      onClick={() => clockToggle(s.user_id, s.name, s.onDuty)}
                    >
                      {s.onDuty ? <><LogOut className="h-3 w-3" /> Out</> : <><LogIn className="h-3 w-3" /> In</>}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Discounts today */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-600" /> Discounts Applied Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {discounts.isLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (discounts.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No discounts applied yet today.</p>
            ) : (
              <ul className="space-y-2">
                {discounts.data!.map((d) => (
                  <li key={d.id} className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{d.action}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.performer_name || "Staff"}
                          {d.table_number ? ` · Table ${d.table_number}` : ""}
                        </p>
                        {d.details && <p className="text-xs mt-0.5 text-foreground/80">{d.details}</p>}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {format(new Date(d.created_at), "h:mm a")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Voids / cancellations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Voids & Cancellations Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          {voids.isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (voids.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No voids today. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {voids.data!.map((d) => (
                <li key={d.id} className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{d.action}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.performer_name || "Staff"}
                        {d.table_number ? ` · Table ${d.table_number}` : ""}
                      </p>
                      {d.details && <p className="text-xs mt-0.5 text-foreground/80">{d.details}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {format(new Date(d.created_at), "h:mm a")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── small subcomponents ────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, loading, accent }: {
  label: string; value: string; icon: any; loading: boolean; accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </div>
        {loading ? <Skeleton className="h-7 w-20" /> : (
          <p className={`text-xl font-black tabular-nums ${accent || ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionButton({ label, icon: Icon, onClick, accent }: {
  label: string; icon: any; onClick: () => void; accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/40 active:scale-[0.98] transition text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className={`h-4 w-4 ${accent || "text-primary"}`} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
