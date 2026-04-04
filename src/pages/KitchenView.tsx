import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ChefHat, Flame, AlertTriangle, RefreshCw, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { playLoudBell } from "@/lib/notification-sounds";
import { motion, AnimatePresence } from "framer-motion";

interface KotTicket {
  id: string;
  order_id: string;
  table_id: string;
  status: string;
  created_at: string;
  items: { id: string; name: string; quantity: number; special_instructions?: string }[];
  tableNumber?: number;
  assigned_chef_id?: string | null;
  assigned_waiter_id?: string | null;
  started_at?: string | null;
  waiterName?: string;
}

const URGENT_MS = 15 * 60 * 1000;

const KitchenView = () => {
  const { hotelId, user } = useAuth();
  const [tickets, setTickets] = useState<KotTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | "pending" | "preparing">("all");
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!hotelId) return;
    const { data: kots } = await supabase
      .from("kot_tickets")
      .select("id, order_id, table_id, status, created_at, assigned_chef_id, assigned_waiter_id, started_at")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "preparing"])
      .order("created_at", { ascending: true });

    if (!kots || kots.length === 0) { setTickets([]); setLoading(false); return; }

    const kotIds = kots.map(k => k.id);
    const tableIds = [...new Set(kots.map(k => k.table_id))];

    const [itemsRes, tablesRes] = await Promise.all([
      supabase.from("kot_items").select("id, kot_id, name, quantity, special_instructions").in("kot_id", kotIds),
      supabase.from("restaurant_tables").select("id, table_number").in("id", tableIds),
    ]);

    const waiterIds = [...new Set(kots.map((k: any) => k.assigned_waiter_id).filter(Boolean))];
    let waiterMap: Record<string, string> = {};
    if (waiterIds.length > 0) {
      const { data: waiterData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", waiterIds);
      (waiterData || []).forEach((w: any) => { waiterMap[w.user_id] = w.full_name || "Staff"; });
    }

    const tableMap = Object.fromEntries((tablesRes.data || []).map(t => [t.id, t.table_number]));
    const itemsMap: Record<string, any[]> = {};
    (itemsRes.data || []).forEach(item => {
      if (!itemsMap[item.kot_id]) itemsMap[item.kot_id] = [];
      itemsMap[item.kot_id].push(item);
    });

    const result = kots.map(k => ({
      ...k,
      items: itemsMap[k.id] || [],
      tableNumber: tableMap[k.table_id],
      waiterName: (k as any).assigned_waiter_id ? waiterMap[(k as any).assigned_waiter_id] : undefined,
    }));

    // Sound for new tickets
    const newIds = new Set(result.map(t => t.id));
    const brandNew = result.filter(t => !prevIdsRef.current.has(t.id) && t.status === "pending");
    if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
      playLoudBell();
    }
    prevIdsRef.current = newIds;

    setTickets(result);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const iv = setInterval(() => fetchTickets(), 10000);
    return () => clearInterval(iv);
  }, [fetchTickets]);

  useEffect(() => {
    if (!hotelId) return;
    const channel = supabase.channel(`kitchen-kots-${hotelId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => fetchTickets())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, fetchTickets]);

  const updateStatus = async (kotId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "preparing") {
      updates.claimed_by = user?.id;
      updates.claimed_at = new Date().toISOString();
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === "ready") { updates.ready_at = new Date().toISOString(); }
    const { error } = await supabase.from("kot_tickets").update(updates).eq("id", kotId);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${newStatus}`); fetchTickets(); }
  };

  const formatTimer = (startTime: string) => {
    const diff = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getElapsedMin = (createdAt: string) => Math.floor((now - new Date(createdAt).getTime()) / 60000);
  const isUrgent = (createdAt: string) => (now - new Date(createdAt).getTime()) > URGENT_MS;

  const pending = tickets.filter(t => t.status === "pending");
  const preparing = tickets.filter(t => t.status === "preparing");
  const filtered = filter === "all" ? tickets : filter === "pending" ? pending : preparing;

  const KotCard = ({ ticket }: { ticket: KotTicket }) => {
    const urgent = isUrgent(ticket.created_at);
    const elapsed = getElapsedMin(ticket.created_at);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-card border rounded-2xl p-5 space-y-3 ${
          ticket.status === "pending"
            ? urgent ? "border-l-4 border-l-destructive animate-pulse" : "border-l-4 border-l-red-400"
            : "border-l-4 border-l-amber-500"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl md:text-4xl font-black text-foreground">T-{ticket.tableNumber}</div>
            <div className="flex items-center gap-2 mt-1">
              {ticket.waiterName && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">by {ticket.waiterName}</span>}
              <Badge variant="outline" className={`text-xs ${ticket.status === "pending" ? "border-red-500/30 text-red-500" : "border-amber-500/30 text-amber-600"}`}>
                {ticket.status.toUpperCase()}
              </Badge>
              {urgent && ticket.status === "pending" && (
                <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse gap-1">
                  <AlertTriangle className="h-3 w-3" /> URGENT
                </Badge>
              )}
            </div>
          </div>
          <div className={`text-right ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="h-4 w-4 inline-block" />
            <div className="text-xl font-mono font-bold">
              {ticket.status === "preparing" && ticket.started_at
                ? formatTimer(ticket.started_at)
                : `${elapsed}m`}
            </div>
          </div>
        </div>
        <div className="space-y-1 border-t border-border pt-2">
          {ticket.items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-foreground"><span className="font-bold text-primary">{item.quantity}×</span> {item.name}</span>
              {item.special_instructions && (
                <span className="text-xs text-amber-600 italic">⚠ {item.special_instructions}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {ticket.status === "pending" && (
            <Button size="lg" className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => updateStatus(ticket.id, "preparing")}>
              <Flame className="h-4 w-4 mr-1" /> Start Cooking
            </Button>
          )}
          {ticket.status === "preparing" && (
            <Button size="lg" className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-bold" onClick={() => updateStatus(ticket.id, "ready")}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Ready
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{pending.length} pending · {preparing.length} cooking</span>
          <Button variant="outline" size="sm" onClick={fetchTickets}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["all", "pending", "preparing"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? f === "pending" ? "bg-red-500 text-white" : f === "preparing" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && ` (${pending.length})`}
            {f === "preparing" && ` (${preparing.length})`}
            {f === "all" && ` (${tickets.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm">{filter === "all" ? "No pending orders. Kitchen is clear!" : `No ${filter} orders`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map(t => <KotCard key={t.id} ticket={t} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default KitchenView;
