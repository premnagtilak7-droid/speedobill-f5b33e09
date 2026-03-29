import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChefHat, Clock, CheckCircle2, Flame, AlertTriangle, RefreshCw, Package, XCircle, LogOut, User, Sun, Moon, Volume2, VolumeX, Filter } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playLoudBell, getNotificationVolume, setNotificationVolume } from "@/lib/notification-sounds";
import { NotificationBell } from "@/components/NotificationBell";
import { useRoleNotifications } from "@/hooks/useRoleNotifications";
import { Slider } from "@/components/ui/slider";

interface KotTicket {
  id: string;
  order_id: string;
  table_id: string;
  status: string;
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  ready_at: string | null;
  assigned_chef_id: string | null;
  assigned_waiter_id: string | null;
  started_at: string | null;
  completed_at: string | null;
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

const URGENT_THRESHOLD_MS = 15 * 60 * 1000;

const ChefKDS = () => {
  const { hotelId, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tickets, setTickets] = useState<KotTicket[]>([]);
  const [items, setItems] = useState<Record<string, KotItem[]>>({});
  const [tables, setTables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState("orders");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "preparing" | "ready">("all");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [waiters, setWaiters] = useState<Record<string, string>>({});
  const [volume, setVolume] = useState(getNotificationVolume());
  const prevTicketIdsRef = useRef<Set<string>>(new Set());

  useRoleNotifications();

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    supabase.from("profiles").select("user_id, full_name").eq("hotel_id", hotelId).in("role", ["waiter", "owner", "manager"])
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((w: any) => { map[w.user_id] = w.full_name || "Staff"; });
        setWaiters(map);
      });
  }, [hotelId]);

  const fetchData = useCallback(async () => {
    if (!hotelId) return;
    const { data: kots } = await supabase
      .from("kot_tickets")
      .select("*")
      .eq("hotel_id", hotelId)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const kotList = (kots || []) as KotTicket[];
    const myTickets = kotList.filter(k => !k.assigned_chef_id || k.assigned_chef_id === user?.id);

    // Detect new tickets for sound
    const newIds = new Set(myTickets.map(t => t.id));
    const prevIds = prevTicketIdsRef.current;
    const brandNewTickets = myTickets.filter(t => !prevIds.has(t.id) && t.status === "pending");
    if (brandNewTickets.length > 0 && prevIds.size > 0) {
      playLoudBell();
      toast.info(`🔔 ${brandNewTickets.length} new order${brandNewTickets.length > 1 ? "s" : ""} received!`, { duration: 4000 });
    }
    prevTicketIdsRef.current = newIds;

    setTickets(myTickets);

    if (myTickets.length > 0) {
      const ids = myTickets.map(k => k.id);
      const { data: allItems } = await supabase
        .from("kot_items")
        .select("*")
        .in("kot_id", ids);
      const grouped: Record<string, KotItem[]> = {};
      (allItems || []).forEach(item => {
        if (!grouped[item.kot_id]) grouped[item.kot_id] = [];
        grouped[item.kot_id].push(item as KotItem);
      });
      setItems(grouped);
    } else {
      setItems({});
    }

    const tableIds = [...new Set(kotList.map(k => k.table_id))];
    if (tableIds.length > 0) {
      const { data: tbls } = await supabase
        .from("restaurant_tables")
        .select("id, table_number")
        .in("id", tableIds);
      const map: Record<string, number> = {};
      (tbls || []).forEach(t => { map[t.id] = t.table_number; });
      setTables(map);
    }

    setLoading(false);
  }, [hotelId, user?.id]);

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

  // Auto-refresh every 10 seconds
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

  // Real-time subscriptions
  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase
      .channel("kds-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => {
        void fetchData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` }, () => {
        void fetchData();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => {
        void fetchData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` }, () => {
        void fetchData();
      })
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked as ${newStatus}`);
    await fetchData();
  };

  const dismissReady = async (kotId: string) => {
    const { error } = await supabase
      .from("kot_tickets")
      .update({ status: "served", completed_at: new Date().toISOString() })
      .eq("id", kotId);
    if (error) { toast.error(error.message); return; }
    toast.success("Served & dismissed");
    await fetchData();
  };

  const toggleMenuAvailability = async (itemId: string, currentlyAvailable: boolean) => {
    setTogglingItem(itemId);
    const { error } = await supabase.from("menu_items").update({ is_available: !currentlyAvailable }).eq("id", itemId);
    if (error) {
      toast.error("Failed to update availability.");
    } else {
      toast.success(!currentlyAvailable ? "Item back in stock" : "Item marked Out of Stock");
      setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, is_available: !currentlyAvailable } : m));
    }
    setTogglingItem(null);
  };

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    setNotificationVolume(v);
  };

  const pending = tickets.filter(t => t.status === "pending");
  const preparing = tickets.filter(t => t.status === "preparing");
  const ready = tickets.filter(t => t.status === "ready");

  const filteredTickets = orderFilter === "all" ? tickets
    : orderFilter === "pending" ? pending
    : orderFilter === "preparing" ? preparing
    : ready;

  const getElapsedMin = (createdAt: string) => Math.floor((now - new Date(createdAt).getTime()) / 60000);
  const isUrgent = (createdAt: string) => (now - new Date(createdAt).getTime()) > URGENT_THRESHOLD_MS;
  const formatTimer = (startTime: string) => {
    const diff = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const KotCard = ({ ticket }: { ticket: KotTicket }) => {
    const elapsed = getElapsedMin(ticket.created_at);
    const urgent = isUrgent(ticket.created_at);
    const kotItems = items[ticket.id] || [];
    const tableNum = tables[ticket.table_id] || "?";
    const waiterName = ticket.assigned_waiter_id ? (waiters[ticket.assigned_waiter_id] || "Waiter") : "";

    const statusColor = ticket.status === "ready"
      ? "border-l-4 border-l-emerald-500"
      : ticket.status === "preparing"
        ? "border-l-4 border-l-amber-500"
        : urgent
          ? "border-l-4 border-l-destructive animate-pulse"
          : "border-l-4 border-l-red-400";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-card rounded-2xl p-5 shadow-lg space-y-3 ${statusColor}`}
      >
        {/* Table number - VERY LARGE */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl md:text-5xl font-black text-foreground leading-none">
              T-{tableNum}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {waiterName && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  by {waiterName}
                </span>
              )}
              <Badge
                className={`text-xs ${
                  ticket.status === "pending" ? "bg-red-500/10 text-red-500 border-red-500/30" :
                  ticket.status === "preparing" ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                  "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                }`}
                variant="outline"
              >
                {ticket.status.toUpperCase()}
              </Badge>
              {urgent && ticket.status === "pending" && (
                <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse gap-1">
                  <AlertTriangle className="h-3 w-3" /> URGENT
                </Badge>
              )}
            </div>
          </div>

          {/* Timer */}
          <div className={`text-right ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="h-5 w-5 inline-block mb-0.5" />
            <div className={`text-2xl font-mono font-bold ${urgent ? "text-destructive" : ""}`}>
              {ticket.status === "preparing" && ticket.started_at
                ? formatTimer(ticket.started_at)
                : `${elapsed}m`}
            </div>
            {ticket.status === "preparing" && (
              <span className="text-[10px] text-amber-500">🔥 cooking</span>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-1.5 border-t border-border pt-3">
          {kotItems.map(item => (
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
          {kotItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Loading items...</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {ticket.status === "pending" && (
            <Button size="lg" className="flex-1 h-12 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white" onClick={() => updateStatus(ticket.id, "preparing")}>
              <Flame className="h-5 w-5 mr-2" /> START COOKING
            </Button>
          )}
          {ticket.status === "preparing" && (
            <Button size="lg" className="flex-1 h-12 text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => updateStatus(ticket.id, "ready")}>
              <CheckCircle2 className="h-5 w-5 mr-2" /> MARK READY
            </Button>
          )}
          {ticket.status === "ready" && (
            <Button size="lg" variant="outline" className="flex-1 h-12 text-base font-bold" onClick={() => dismissReady(ticket.id)}>
              <CheckCircle2 className="h-5 w-5 mr-2" /> SERVED
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  const lowStockIngredients = ingredients.filter(i => i.current_stock <= i.min_threshold);
  const oosMenuItems = menuItems.filter(m => !m.is_available);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Chef";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Volume control */}
          <div className="flex items-center gap-2 bg-card rounded-xl px-3 py-1.5 border border-border">
            {volume === 0 ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
            <Slider
              value={[volume]}
              min={0} max={1} step={0.1}
              onValueChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          <NotificationBell />

          <Button variant="outline" size="sm" onClick={() => activeTab === "orders" ? fetchData() : fetchIngredients()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
          </button>
          <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">{userInitials}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Profile Bar */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{userName}</span>
          <Badge variant="outline" className="text-[10px]">Chef</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{user?.email}</span>
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
            {lowStockIngredients.length > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] ml-1">{lowStockIngredients.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "pending", "preparing", "ready"] as const).map(f => (
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
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "pending" && pending.length > 0 && ` (${pending.length})`}
                {f === "preparing" && preparing.length > 0 && ` (${preparing.length})`}
                {f === "ready" && ready.length > 0 && ` (${ready.length})`}
                {f === "all" && tickets.length > 0 && ` (${tickets.length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-20">
              <ChefHat className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-lg text-muted-foreground">
                {orderFilter === "all" ? "No active orders. Kitchen is clear!" : `No ${orderFilter} orders`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredTickets.map(t => <KotCard key={t.id} ticket={t} />)}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Inventory / Stock Tab */}
        <TabsContent value="inventory">
          {ingredientsLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2 px-1">
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
                          {isLow && (
                            <Badge className="bg-destructive/10 text-destructive text-[10px] gap-1">
                              <AlertTriangle className="h-3 w-3" /> LOW
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2 px-1">
                  <XCircle className="h-4 w-4 text-destructive" /> Menu Availability
                  {oosMenuItems.length > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px]">{oosMenuItems.length} OOS</Badge>}
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
                          {!item.is_available && (
                            <Badge variant="destructive" className="text-[10px] shrink-0">OOS</Badge>
                          )}
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
