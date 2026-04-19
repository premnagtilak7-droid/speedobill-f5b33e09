import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChefHat, Clock, CheckCircle2, Flame, AlertTriangle, RefreshCw, Package, XCircle, Filter, UtensilsCrossed, Volume2, VolumeX, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { playLoudBell } from "@/lib/notification-sounds";
import { useRoleNotifications } from "@/hooks/useRoleNotifications";
import { safeStorage } from "@/lib/safe-storage";

interface KotTicket {
  id: string;
  order_id: string;
  table_id: string;
  status: string;
  created_at: string;
  claimed_by: string | null;
  assigned_chef_id: string | null;
  assigned_waiter_id: string | null;
  started_at: string | null;
}

interface KotItem {
  id: string;
  kot_id: string;
  name: string;
  quantity: number;
  price: number;
  special_instructions: string | null;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_threshold: number;
}

interface MenuItem {
  id: string;
  name: string;
  is_available: boolean;
}

const URGENT_MS = 15 * 60 * 1000;
const RUSH_THRESHOLD = 5;

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  "dine-in":   { label: "Dine-In",   cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  "online-qr": { label: "QR",        cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  takeaway:    { label: "Takeaway",  cls: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  delivery:    { label: "Delivery",  cls: "bg-fuchsia-500/15 text-fuchsia-500 border-fuchsia-500/30" },
  swiggy:      { label: "Swiggy",    cls: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  zomato:      { label: "Zomato",    cls: "bg-red-500/15 text-red-500 border-red-500/30" },
};

const ChefKDS = () => {
  const { hotelId, user } = useAuth();
  const [tickets, setTickets] = useState<KotTicket[]>([]);
  const [items, setItems] = useState<Record<string, KotItem[]>>({});
  const [tableMap, setTableMap] = useState<Record<string, number>>({});
  const [orderSourceMap, setOrderSourceMap] = useState<Record<string, string>>({});
  const [waiterMap, setWaiterMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState("orders");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "preparing" | "ready">("all");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => safeStorage.getItem("kds_sound_on") !== "0");
  const [flashKey, setFlashKey] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());

  useRoleNotifications();

  useEffect(() => { safeStorage.setItem("kds_sound_on", soundOn ? "1" : "0"); }, [soundOn]);

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Fetch waiter names once
  useEffect(() => {
    if (!hotelId) return;
    supabase.from("profiles").select("user_id, full_name").eq("hotel_id", hotelId)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((w: any) => { map[w.user_id] = w.full_name || "Staff"; });
        setWaiterMap(map);
      });
  }, [hotelId]);

  const fetchData = useCallback(async () => {
    if (!hotelId) return;
    const { data: kots } = await supabase
      .from("kot_tickets")
      .select("id, order_id, table_id, status, created_at, claimed_by, assigned_chef_id, assigned_waiter_id, started_at")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const kotList = (kots || []) as KotTicket[];
    // Show tickets assigned to this chef OR unassigned
    const myTickets = kotList.filter(k => !k.assigned_chef_id || k.assigned_chef_id === user?.id);

    // Sound + flash for new pending tickets
    const newIds = new Set(myTickets.map(t => t.id));
    const brandNew = myTickets.filter(t => !prevIdsRef.current.has(t.id) && t.status === "pending");
    if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
      if (soundOn) playLoudBell();
      setFlashKey(k => k + 1);
      toast.info(`🔔 ${brandNew.length} new order${brandNew.length > 1 ? "s" : ""}!`, { duration: 4000 });
    }
    prevIdsRef.current = newIds;
    setTickets(myTickets);

    // Fetch items
    if (myTickets.length > 0) {
      const ids = myTickets.map(k => k.id);
      const { data: allItems } = await supabase.from("kot_items").select("*").in("kot_id", ids);
      const grouped: Record<string, KotItem[]> = {};
      (allItems || []).forEach(item => {
        if (!grouped[item.kot_id]) grouped[item.kot_id] = [];
        grouped[item.kot_id].push(item as KotItem);
      });
      setItems(grouped);
    } else {
      setItems({});
    }

    // Fetch table numbers + order sources
    const tableIds = [...new Set(kotList.map(k => k.table_id))];
    const orderIds = [...new Set(kotList.map(k => k.order_id))];
    const [tblRes, ordRes] = await Promise.all([
      tableIds.length ? supabase.from("restaurant_tables").select("id, table_number").in("id", tableIds) : Promise.resolve({ data: [] as any[] }),
      orderIds.length ? supabase.from("orders").select("id, order_source").in("id", orderIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const tMap: Record<string, number> = {};
    (tblRes.data || []).forEach((t: any) => { tMap[t.id] = t.table_number; });
    setTableMap(tMap);
    const sMap: Record<string, string> = {};
    (ordRes.data || []).forEach((o: any) => { sMap[o.id] = o.order_source || "dine-in"; });
    setOrderSourceMap(sMap);

    setLoading(false);
  }, [hotelId, user?.id, soundOn]);

  const fetchIngredients = useCallback(async () => {
    if (!hotelId) return;
    setIngredientsLoading(true);
    const [ingRes, menuRes] = await Promise.all([
      supabase.from("ingredients").select("id, name, unit, current_stock, min_threshold").eq("hotel_id", hotelId).order("name"),
      supabase.from("menu_items").select("id, name, is_available").eq("hotel_id", hotelId).order("name"),
    ]);
    setIngredients((ingRes.data || []) as Ingredient[]);
    setMenuItems((menuRes.data || []) as MenuItem[]);
    setIngredientsLoading(false);
  }, [hotelId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh every 10s
  useEffect(() => {
    const iv = setInterval(() => {
      if (activeTab === "orders") void fetchData();
      else void fetchIngredients();
    }, 10000);
    return () => clearInterval(iv);
  }, [fetchData, fetchIngredients, activeTab]);

  useEffect(() => {
    if (activeTab === "inventory") void fetchIngredients();
  }, [activeTab, fetchIngredients]);

  // Real-time
  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase.channel(`kds-rt-${hotelId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => void fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => void fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, fetchData]);

  const updateStatus = async (kotId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "preparing") {
      updates.claimed_by = user?.id;
      updates.claimed_at = new Date().toISOString();
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === "ready") {
      updates.ready_at = new Date().toISOString();
    }
    const { error } = await supabase.from("kot_tickets").update(updates).eq("id", kotId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${newStatus}`);
    await fetchData();
  };

  const markAllReady = async () => {
    if (preparing.length === 0) return;
    if (!confirm(`Mark all ${preparing.length} cooking orders as READY?`)) return;
    setBulkBusy(true);
    const nowIso = new Date().toISOString();
    const ids = preparing.map(t => t.id);
    const { error } = await supabase
      .from("kot_tickets")
      .update({ status: "ready", ready_at: nowIso })
      .in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ ${ids.length} orders marked ready`);
    await fetchData();
  };

  const toggleMenuAvailability = async (itemId: string, currentlyAvailable: boolean) => {
    setTogglingItem(itemId);
    const { error } = await supabase.from("menu_items").update({ is_available: !currentlyAvailable }).eq("id", itemId);
    if (error) toast.error("Failed to update");
    else {
      toast.success(!currentlyAvailable ? "Back in stock" : "Marked Out of Stock");
      setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, is_available: !currentlyAvailable } : m));
    }
    setTogglingItem(null);
  };

  const pending = tickets.filter(t => t.status === "pending");
  const preparing = tickets.filter(t => t.status === "preparing");
  const ready = tickets.filter(t => t.status === "ready");
  const filtered = orderFilter === "all" ? tickets
    : orderFilter === "pending" ? pending
    : orderFilter === "preparing" ? preparing : ready;

  const getElapsedMin = (c: string) => Math.floor((now - new Date(c).getTime()) / 60000);
  const isUrgent = (c: string) => (now - new Date(c).getTime()) > URGENT_MS;
  const formatTimer = (s: string) => {
    const diff = Math.max(0, Math.floor((now - new Date(s).getTime()) / 1000));
    return `${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, '0')}`;
  };

  const lowStock = ingredients.filter(i => i.current_stock <= i.min_threshold);
  const oosItems = menuItems.filter(m => !m.is_available);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground">
              {pending.length} pending · {preparing.length} cooking · {ready.length} ready
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => activeTab === "orders" ? fetchData() : fetchIngredients()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="orders" className="gap-1.5">
            <ChefHat className="h-4 w-4" /> Orders
            {tickets.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{tickets.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" /> Stock
            {lowStock.length > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] ml-1">{lowStock.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "pending", "preparing", "ready"] as const).map(f => {
              const count = f === "all" ? tickets.length : f === "pending" ? pending.length : f === "preparing" ? preparing.length : ready.length;
              return (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    orderFilter === f
                      ? f === "pending" ? "bg-red-500 text-white"
                        : f === "preparing" ? "bg-amber-500 text-white"
                        : f === "ready" ? "bg-emerald-500 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}{count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-48 bg-card border border-border rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <ChefHat className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-lg text-muted-foreground">
                {orderFilter === "all" ? "No active orders. Kitchen is clear! 🎉" : `No ${orderFilter} orders`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filtered.map(ticket => {
                  const kotItems = items[ticket.id] || [];
                  const tableNum = tableMap[ticket.table_id] || "?";
                  const waiterName = ticket.assigned_waiter_id ? (waiterMap[ticket.assigned_waiter_id] || "Waiter") : "";
                  const urgent = isUrgent(ticket.created_at);
                  const elapsed = getElapsedMin(ticket.created_at);

                  const borderColor = ticket.status === "ready"
                    ? "border-l-4 border-l-emerald-500"
                    : ticket.status === "preparing"
                    ? "border-l-4 border-l-amber-500"
                    : urgent ? "border-l-4 border-l-destructive animate-pulse" : "border-l-4 border-l-red-400";

                  return (
                    <motion.div
                      key={ticket.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`bg-card rounded-2xl p-5 shadow-lg space-y-3 ${borderColor}`}
                    >
                      {/* Table + Timer */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-4xl md:text-5xl font-black text-foreground leading-none">
                            T-{tableNum}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {waiterName && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">by {waiterName}</span>
                            )}
                            <Badge variant="outline" className={`text-xs ${
                              ticket.status === "pending" ? "border-red-500/30 text-red-500"
                              : ticket.status === "preparing" ? "border-amber-500/30 text-amber-600"
                              : "border-emerald-500/30 text-emerald-600"
                            }`}>
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
                          <Clock className="h-5 w-5 inline-block mb-0.5" />
                          <div className="text-2xl font-mono font-bold">
                            {ticket.status === "preparing" && ticket.started_at
                              ? formatTimer(ticket.started_at)
                              : `${elapsed}m`}
                          </div>
                          {ticket.status === "preparing" && (
                            <span className="text-[10px] text-amber-500">🔥 cooking</span>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 border-t border-border pt-3">
                        {kotItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Loading items...</p>
                        ) : kotItems.map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-primary">{item.quantity}×</span>
                                <span className="text-base font-medium text-foreground">{item.name}</span>
                              </div>
                              {item.special_instructions && (
                                <p className="text-sm text-amber-600 italic ml-8 font-medium">⚠ {item.special_instructions}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ── ACTION BUTTONS ── */}
                      <div className="flex gap-2 pt-2">
                        {ticket.status === "pending" && (
                          <Button
                            size="lg"
                            className="flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                            onClick={() => updateStatus(ticket.id, "preparing")}
                          >
                            <Flame className="h-5 w-5 mr-2" /> START COOKING
                          </Button>
                        )}
                        {ticket.status === "preparing" && (
                          <Button
                            size="lg"
                            className="flex-1 h-14 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
                            onClick={() => updateStatus(ticket.id, "ready")}
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" /> MARK READY
                          </Button>
                        )}
                        {ticket.status === "ready" && (
                          <div className="flex-1 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                            <CheckCircle2 className="h-5 w-5" /> READY — Waiting for pickup
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="inventory">
          {ingredientsLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ingredients */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Ingredient Stock
                </h2>
                {ingredients.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">No ingredients configured</div>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map(ing => {
                      const isLow = ing.current_stock <= ing.min_threshold;
                      return (
                        <div key={ing.id} className={`bg-card border rounded-xl p-3 flex items-center justify-between ${isLow ? "border-destructive/50" : "border-border"}`}>
                          <div>
                            <p className="text-sm font-medium text-foreground">{ing.name}</p>
                            <p className="text-xs text-muted-foreground">{ing.current_stock} {ing.unit} remaining</p>
                          </div>
                          {isLow && <Badge className="bg-destructive/10 text-destructive text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> LOW</Badge>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Menu Availability */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" /> Menu Availability
                  {oosItems.length > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px]">{oosItems.length} OOS</Badge>}
                </h2>
                {menuItems.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">No menu items found</div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {menuItems.map(item => (
                      <div key={item.id} className={`bg-card border rounded-xl p-3 flex items-center justify-between ${!item.is_available ? "border-destructive/40 opacity-70" : "border-border"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate ${!item.is_available ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {item.name}
                          </span>
                          {!item.is_available && <Badge variant="destructive" className="text-[10px] shrink-0">OOS</Badge>}
                        </div>
                        <Switch
                          checked={item.is_available}
                          disabled={togglingItem === item.id}
                          onCheckedChange={() => toggleMenuAvailability(item.id, item.is_available)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChefKDS;
