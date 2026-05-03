import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, ChefHat, UtensilsCrossed, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface WaiterKot {
  id: string;
  order_id: string;
  table_id: string;
  status: string;
  created_at: string;
  ready_at: string | null;
  started_at: string | null;
  assigned_waiter_id: string | null;
  tableNumber?: number;
  items: { id: string; name: string; quantity: number }[];
}

const WaiterOrders = () => {
  const { hotelId, user } = useAuth();
  const [tickets, setTickets] = useState<WaiterKot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyOrders = useCallback(async () => {
    if (!hotelId || !user) return;
    const today = new Date().toISOString().split("T")[0];

    // Get KOT tickets where this waiter is assigned OR where the order was placed by this waiter
    const { data: kots } = await supabase
      .from("kot_tickets")
      .select("id, order_id, table_id, status, created_at, ready_at, started_at, assigned_waiter_id")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "preparing", "ready"])
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false });

    if (!kots || kots.length === 0) { setTickets([]); setLoading(false); return; }

    // Filter: assigned to me, or order placed by me
    const orderIds = [...new Set(kots.map(k => k.order_id))];
    const { data: orders } = await supabase
      .from("orders")
      .select("id, waiter_id")
      .in("id", orderIds);

    const myOrderIds = new Set((orders || []).filter(o => o.waiter_id === user.id).map(o => o.id));
    const myKots = kots.filter(k => k.assigned_waiter_id === user.id || myOrderIds.has(k.order_id));

    if (myKots.length === 0) { setTickets([]); setLoading(false); return; }

    const kotIds = myKots.map(k => k.id);
    const tableIds = [...new Set(myKots.map(k => k.table_id))];

    const [itemsRes, tablesRes] = await Promise.all([
      supabase.from("kot_items").select("id, kot_id, name, quantity").in("kot_id", kotIds),
      supabase.from("restaurant_tables").select("id, table_number").in("id", tableIds),
    ]);

    const tableMap = Object.fromEntries((tablesRes.data || []).map(t => [t.id, t.table_number]));
    const itemsMap: Record<string, any[]> = {};
    (itemsRes.data || []).forEach(item => {
      if (!itemsMap[item.kot_id]) itemsMap[item.kot_id] = [];
      itemsMap[item.kot_id].push(item);
    });

    setTickets(myKots.map(k => ({
      ...k,
      tableNumber: tableMap[k.table_id],
      items: itemsMap[k.id] || [],
    })));
    setLoading(false);
  }, [hotelId, user]);

  useEffect(() => { void fetchMyOrders(); }, [fetchMyOrders]);

  // Auto-refresh + realtime
  useEffect(() => {
    const iv = setInterval(() => void fetchMyOrders(), 10000);
    return () => clearInterval(iv);
  }, [fetchMyOrders]);

  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase.channel(`waiter-orders-rt-${hotelId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => void fetchMyOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, fetchMyOrders]);

  const markServed = async (kotId: string) => {
    const { error } = await supabase.from("kot_tickets")
      .update({ status: "served", completed_at: new Date().toISOString() })
      .eq("id", kotId);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Marked as Served!");
    await fetchMyOrders();
  };

  const readyOrders = tickets.filter(t => t.status === "ready");
  const cookingOrders = tickets.filter(t => t.status === "preparing");
  const pendingOrders = tickets.filter(t => t.status === "pending");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Orders</h1>
            <p className="text-xs text-muted-foreground">
              {readyOrders.length} ready · {cookingOrders.length} cooking · {pendingOrders.length} pending
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMyOrders}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Ready for pickup - highlighted */}
      {readyOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Ready for Pickup ({readyOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {readyOrders.map(ticket => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-black text-foreground">T-{ticket.tableNumber}</div>
                    <Badge className="bg-emerald-500 text-white">READY</Badge>
                  </div>
                  <div className="space-y-1">
                    {ticket.items.map(item => (
                      <div key={item.id} className="text-sm text-foreground">
                        <span className="font-bold text-primary">{item.quantity}×</span> {item.name}
                      </div>
                    ))}
                  </div>
                  {ticket.ready_at && (
                    <p className="text-xs text-muted-foreground">
                      Ready {formatDistanceToNow(new Date(ticket.ready_at), { addSuffix: true })}
                    </p>
                  )}
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                    onClick={() => markServed(ticket.id)}
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" /> MARK AS SERVED
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Cooking */}
      {cookingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
            <ChefHat className="h-4 w-4" /> Being Prepared ({cookingOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cookingOrders.map(ticket => (
              <div key={ticket.id} className="bg-card border-l-4 border-l-amber-500 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-black text-foreground">T-{ticket.tableNumber}</div>
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30" variant="outline">PREPARING</Badge>
                </div>
                <div className="space-y-1">
                  {ticket.items.map(item => (
                    <div key={item.id} className="text-sm text-foreground">
                      <span className="font-bold text-primary">{item.quantity}×</span> {item.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pending ({pendingOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingOrders.map(ticket => (
              <div key={ticket.id} className="bg-card border-l-4 border-l-red-400 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-black text-foreground">T-{ticket.tableNumber}</div>
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/30" variant="outline">PENDING</Badge>
                </div>
                <div className="space-y-1">
                  {ticket.items.map(item => (
                    <div key={item.id} className="text-sm text-foreground">
                      <span className="font-bold text-primary">{item.quantity}×</span> {item.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tickets.length === 0 && !loading && (
        <div className="text-center py-20">
          <UtensilsCrossed className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
          <p className="text-lg text-muted-foreground">No active orders right now</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-card border border-border rounded-2xl animate-pulse" />)}
        </div>
      )}
    </div>
  );
};

export default WaiterOrders;
