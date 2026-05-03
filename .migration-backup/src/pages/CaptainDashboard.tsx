import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Grid3X3, Bell, ChefHat, ScrollText, Users, Receipt,
  Wallet, ClipboardList, AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number | null;
  status: string;
  section_name: string | null;
}

interface OrderRow {
  id: string;
  table_id: string;
  total: number;
  status: string;
  created_at: string;
}

interface KotRow {
  id: string;
  status: string;
  table_id: string;
  ready_at: string | null;
}

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  available: { label: "Available", classes: "border-green-500/60 bg-green-500/10 text-green-400" },
  occupied: { label: "Occupied", classes: "border-red-500/60 bg-red-500/10 text-red-400" },
  reserved: { label: "Reserved", classes: "border-yellow-500/60 bg-yellow-500/10 text-yellow-400" },
  bill_requested: { label: "Bill", classes: "border-blue-500/60 bg-blue-500/10 text-blue-400" },
  cleaning: { label: "Cleaning", classes: "border-muted bg-muted/20 text-muted-foreground" },
};

const CaptainDashboard = () => {
  const { user, hotelId } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<string | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [kots, setKots] = useState<KotRow[]>([]);
  const [todayHandled, setTodayHandled] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch captain's assigned section
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("assigned_section_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSection((data as any)?.assigned_section_name ?? null));
  }, [user]);

  const refresh = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      // Tables in section
      let q = supabase
        .from("restaurant_tables")
        .select("id, table_number, capacity, status, section_name")
        .eq("hotel_id", hotelId)
        .order("table_number");
      if (section) q = q.eq("section_name", section);
      const { data: tableData } = await q;
      const ts = (tableData ?? []) as RestaurantTable[];
      setTables(ts);

      const tableIds = ts.map((t) => t.id);
      if (tableIds.length === 0) {
        setOrders([]); setKots([]); setTodayHandled(0); setLoading(false);
        return;
      }

      const [{ data: ordRows }, { data: kotRows }, { data: todayRows }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, table_id, total, status, created_at")
          .eq("hotel_id", hotelId)
          .in("table_id", tableIds)
          .eq("status", "active"),
        supabase
          .from("kot_tickets")
          .select("id, status, table_id, ready_at")
          .eq("hotel_id", hotelId)
          .in("table_id", tableIds)
          .in("status", ["pending", "preparing", "ready"]),
        supabase
          .from("orders")
          .select("id")
          .eq("hotel_id", hotelId)
          .in("table_id", tableIds)
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      setOrders((ordRows ?? []) as OrderRow[]);
      setKots((kotRows ?? []) as KotRow[]);
      setTodayHandled((todayRows ?? []).length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    if (!hotelId) return;
    // Realtime refresh on table/order/kot changes
    const ch = supabase
      .channel(`captain-${hotelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `hotel_id=eq.${hotelId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, section]);

  const readyCount = useMemo(() => kots.filter((k) => k.status === "ready").length, [kots]);
  const activeOrders = orders.length;
  const totalTables = tables.length;

  const handleTableClick = (t: RestaurantTable) => {
    if (t.status === "available") {
      navigate(`/counter?tableId=${t.id}`);
    } else {
      navigate(`/tables`);
    }
  };

  if (!section) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="p-8 text-center max-w-xl mx-auto border-yellow-500/40 bg-yellow-500/5">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
          <h2 className="text-2xl font-bold mb-2">No Section Assigned</h2>
          <p className="text-muted-foreground mb-4">
            Ask the owner to assign you a floor section in <strong>Staff → Edit Captain</strong>. You'll see your tables here once assigned.
          </p>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-32 md:pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Captain Console</h1>
          <p className="text-sm text-muted-foreground">
            Section: <Badge variant="secondary" className="ml-1">{section}</Badge>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Grid3X3} label="My Tables" value={totalTables} accent="text-primary" />
        <StatCard icon={ScrollText} label="Active Orders" value={activeOrders} accent="text-orange-400" />
        <StatCard icon={ChefHat} label="Ready to Serve" value={readyCount} accent="text-green-400" />
        <StatCard icon={ClipboardList} label="Today's Orders" value={todayHandled} accent="text-blue-400" />
      </div>

      {/* Section visual map */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" /> My Section Map
          </h2>
          <span className="text-xs text-muted-foreground">{tables.length} tables</span>
        </div>
        {tables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No tables in this section yet. Ask the owner to add tables under "{section}".
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {tables.map((t) => {
              const style = STATUS_STYLES[t.status] ?? STATUS_STYLES.available;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTableClick(t)}
                  className={`relative aspect-square rounded-2xl border-2 ${style.classes} transition-transform active:scale-95 hover:scale-[1.03] flex flex-col items-center justify-center p-2 min-h-[88px]`}
                >
                  <span className="text-2xl font-bold">{t.table_number}</span>
                  <span className="text-[10px] uppercase tracking-wide mt-1">{style.label}</span>
                  {t.capacity ? (
                    <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />{t.capacity}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <Card className="p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Bell className="w-5 h-5" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ActionTile icon={ScrollText} label="New Order" onClick={() => navigate("/counter")} />
          <ActionTile icon={Grid3X3} label="My Tables" onClick={() => navigate("/tables")} />
          <ActionTile icon={ChefHat} label="Ready Orders" onClick={() => navigate("/incoming-orders")} />
          <ActionTile icon={Receipt} label="Generate Bill" onClick={() => navigate("/tables")} />
          <ActionTile icon={Wallet} label="Accept Payment" onClick={() => navigate("/tables")} />
        </div>
      </Card>

      {/* Mobile bottom action bar */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border px-2 py-2 z-30 grid grid-cols-5 gap-1">
        <BottomBtn icon={ScrollText} label="Order" onClick={() => navigate("/counter")} />
        <BottomBtn icon={Grid3X3} label="Tables" onClick={() => navigate("/tables")} />
        <BottomBtn icon={ChefHat} label="Ready" badge={readyCount} onClick={() => navigate("/incoming-orders")} />
        <BottomBtn icon={Receipt} label="Bill" onClick={() => navigate("/tables")} />
        <BottomBtn icon={Wallet} label="Pay" onClick={() => navigate("/tables")} />
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: any) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold mt-1 ${accent}`}>{value}</p>
      </div>
      <Icon className={`w-8 h-8 ${accent} opacity-70`} />
    </div>
  </Card>
);

const ActionTile = ({ icon: Icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="rounded-2xl border border-border bg-secondary/30 hover:bg-secondary p-4 transition-all active:scale-95 flex flex-col items-center gap-2 min-h-[88px]"
  >
    <Icon className="w-6 h-6 text-primary" />
    <span className="text-sm font-semibold text-center">{label}</span>
  </button>
);

const BottomBtn = ({ icon: Icon, label, badge, onClick }: any) => (
  <button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center py-1.5 rounded-lg active:bg-secondary"
  >
    <Icon className="w-5 h-5 text-primary" />
    <span className="text-[10px] mt-0.5">{label}</span>
    {badge && badge > 0 ? (
      <span className="absolute top-0 right-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-1.5 min-w-[16px] h-4 flex items-center justify-center">
        {badge}
      </span>
    ) : null}
  </button>
);

export default CaptainDashboard;
