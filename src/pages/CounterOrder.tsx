import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Store, Plus, Minus, ShoppingCart, Trash2, Printer, Receipt, Clock3, Hash } from "lucide-react";

interface PriceVariant {
  label: string;
  price: number;
}

interface CartItem {
  id: string;
  key: string;
  name: string;
  price: number;
  qty: number;
}

interface CounterOrderRow {
  id: string;
  token_number: number;
  total_amount: number;
  waiter_name: string | null;
  created_at: string;
  items: Array<{ name: string; price: number; qty: number }>;
}

const getTodayStartIso = () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return todayStart.toISOString();
};

const isTodayOrder = (createdAt: string) => {
  const orderDate = new Date(createdAt);
  const now = new Date();

  return (
    orderDate.getFullYear() === now.getFullYear() &&
    orderDate.getMonth() === now.getMonth() &&
    orderDate.getDate() === now.getDate()
  );
};

const CounterOrder = () => {
  const { user, hotelId } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [variantItem, setVariantItem] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<CounterOrderRow[]>([]);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<CounterOrderRow | null>(null);

  useEffect(() => {
    if (!hotelId) return;

    const fetchData = async () => {
      setLoading(true);
      const [menuRes, profRes, recentRes] = await Promise.all([
        supabase.from("menu_items").select("*").eq("hotel_id", hotelId).eq("is_available", true).order("category"),
        supabase.from("profiles").select("full_name").eq("user_id", user?.id).maybeSingle(),
        supabase
          .from("counter_orders")
          .select("id, token_number, total_amount, waiter_name, created_at, items")
          .eq("hotel_id", hotelId)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      setMenuItems(menuRes.data || []);
      setProfile(profRes.data);
      setRecentOrders((recentRes.data as CounterOrderRow[]) || []);
      setLoading(false);
    };

    void fetchData();
  }, [hotelId, user?.id]);

  const handleItemClick = (item: any) => {
    const variants = ((item.price_variants as PriceVariant[] | null) || []).filter((v) => v.label && v.price > 0);
    if (variants.length > 0) {
      setVariantItem(item);
    } else {
      addToCart(item.id, item.name, item.price);
    }
  };

  const addToCart = (itemId: string, name: string, price: number, variantLabel?: string) => {
    const key = variantLabel ? `${itemId}-${variantLabel}` : itemId;
    const displayName = variantLabel ? `${name} (${variantLabel})` : name;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) return prev.map((c) => (c.key === key ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: itemId, key, name: displayName, price, qty: 1 }];
    });
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, qty: Math.max(1, c.qty + delta) } : c)));
  };

  const removeFromCart = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));

  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart]);
  const filtered = useMemo(
    () => menuItems.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [menuItems, search],
  );
  const latestToken = useMemo(() => {
    const todayOrder = recentOrders.find((order) => isTodayOrder(order.created_at));
    if (todayOrder) return todayOrder.token_number;
    if (lastPlacedOrder && isTodayOrder(lastPlacedOrder.created_at)) return lastPlacedOrder.token_number;
    return null;
  }, [recentOrders, lastPlacedOrder]);

  const buildTokenText = (order: CounterOrderRow) => {
    const lines: string[] = [];
    lines.push("═".repeat(32));
    lines.push("       SPEEDOBILL COUNTER");
    lines.push("═".repeat(32));
    lines.push(`TOKEN: #${order.token_number}`);
    lines.push(`TYPE : TAKEAWAY`);
    lines.push(`TIME : ${new Date(order.created_at).toLocaleString("en-IN")}`);
    lines.push(`STAFF: ${order.waiter_name || "Staff"}`);
    lines.push("─".repeat(32));
    order.items.forEach((item) => {
      lines.push(`${item.qty}x ${item.name}`);
      lines.push(`   ₹${Number(item.price).toFixed(0)} = ₹${(Number(item.price) * Number(item.qty)).toFixed(0)}`);
    });
    lines.push("─".repeat(32));
    lines.push(`TOTAL: ₹${Number(order.total_amount).toFixed(0)}`);
    lines.push("═".repeat(32));
    lines.push("Show this token at counter");
    lines.push("Thank you!");
    return lines.join("\n");
  };

  const handlePrintToken = (order: CounterOrderRow) => {
    const popup = window.open("", "_blank", "width=380,height=700");
    if (!popup) {
      toast.error("Popup blocked. Allow popups to print token.");
      return;
    }

    const receipt = buildTokenText(order)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    popup.document.write(`<html><head><title>Token #${order.token_number}</title><style>body{font-family:'Courier New',monospace;padding:12px;white-space:pre-wrap;font-size:12px;line-height:1.5;color:#000}pre{margin:0}button{display:none}@media print{body{margin:0}}</style></head><body><pre>${receipt}</pre><script>window.onload=function(){window.focus();window.print();}</script></body></html>`);
    popup.document.close();
  };

  const placeOrder = async () => {
    if (!cart.length || !hotelId || !user) return;
    setPlacing(true);

    const { data: latestTodayOrder, error: tokenError } = await supabase
      .from("counter_orders")
      .select("token_number")
      .eq("hotel_id", hotelId)
      .gte("created_at", getTodayStartIso())
      .order("token_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      toast.error(`Token failed: ${tokenError.message}`);
      setPlacing(false);
      return;
    }

    const nextTokenNumber = (latestTodayOrder?.token_number ?? 0) + 1;

    const { data: insertedOrder, error } = await supabase
      .from("counter_orders")
      .insert({
        hotel_id: hotelId,
        waiter_id: user.id,
        waiter_name: profile?.full_name || "",
        token_number: nextTokenNumber,
        total_amount: total,
        items: cart.map((c) => ({ name: c.name, price: c.price, qty: c.qty })),
      })
      .select("id, token_number, total_amount, waiter_name, created_at, items")
      .single();

    if (error) {
      toast.error("Order failed: " + error.message);
    } else {
      const savedOrder = insertedOrder as CounterOrderRow;
      toast.success(`Token #${savedOrder.token_number} ready — ₹${total.toFixed(0)}`);
      setLastPlacedOrder(savedOrder);
      setRecentOrders((prev) => [savedOrder, ...prev.filter((order) => order.id !== savedOrder.id)].slice(0, 12));
      setCart([]);
      handlePrintToken(savedOrder);
    }
    setPlacing(false);
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Counter Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Token-wise takeaway billing with instant print.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1"><Receipt className="h-3.5 w-3.5" /> Takeaway</Badge>
          <Badge variant="outline" className="gap-1"><Hash className="h-3.5 w-3.5" /> Today's Token {latestToken ? `#${latestToken}` : "—"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-3">
          <Input placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[44px]" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filtered.map((item) => {
              const variants = ((item.price_variants as PriceVariant[] | null) || []).filter((v: PriceVariant) => v.label && v.price > 0);
              const hasVariants = variants.length > 0;
              const priceLabel = hasVariants ? `₹${Math.min(...variants.map((v: PriceVariant) => v.price))}+` : `₹${item.price}`;
              const qty = cart.filter((c) => c.key.startsWith(item.id)).reduce((s, c) => s + c.qty, 0);
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="relative rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50 min-h-[96px]"
                >
                  {qty > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-primary px-1 text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </div>
                  )}
                  <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                  <p className="text-sm font-bold text-primary mt-2">{priceLabel}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart ({cart.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tap items to add</p>}
              {cart.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">₹{c.price} × {c.qty}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(c.key, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm">{c.qty}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(c.key, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(c.key)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              {cart.length > 0 && (
                <>
                  <div className="border-t pt-3 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>₹{total.toFixed(0)}</span>
                  </div>
                  <Button className="w-full min-h-[48px]" onClick={placeOrder} disabled={placing}>
                    {placing ? "Creating token..." : "Create Token & Print"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {lastPlacedOrder && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" /> Last Printed Token</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xl font-bold text-primary">#{lastPlacedOrder.token_number}</p>
                      <p className="text-xs text-muted-foreground">₹{Number(lastPlacedOrder.total_amount).toFixed(0)} • {lastPlacedOrder.items.length} items</p>
                    </div>
                    <Badge variant="outline" className="gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(lastPlacedOrder.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full min-h-[44px]" onClick={() => handlePrintToken(lastPlacedOrder)}>
                  <Printer className="h-4 w-4 mr-2" /> Reprint Last Token
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Recent Counter Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No counter tokens yet.</p>
          ) : (
            <div className="grid gap-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-primary">Token #{order.token_number}</p>
                      <Badge variant="outline">₹{Number(order.total_amount).toFixed(0)}</Badge>
                      <Badge variant="secondary">{order.items.length} items</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{order.waiter_name || "Staff"} • {new Date(order.created_at).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}
                    </p>
                  </div>
                  <Button variant="outline" className="min-h-[44px]" onClick={() => handlePrintToken(order)}>
                    <Printer className="h-4 w-4 mr-2" /> Print Token
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!variantItem} onOpenChange={(open) => { if (!open) setVariantItem(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">{variantItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">Select a variant:</p>
          <div className="space-y-2">
            {((variantItem?.price_variants as PriceVariant[] | null) || [])
              .filter((v: PriceVariant) => v.label && v.price > 0)
              .map((v: PriceVariant) => (
                <Button
                  key={v.label}
                  variant="outline"
                  className="w-full justify-between h-11"
                  onClick={() => {
                    addToCart(variantItem!.id, variantItem!.name, v.price, v.label);
                    setVariantItem(null);
                  }}
                >
                  <span className="capitalize font-medium">{v.label}</span>
                  <span className="font-bold text-primary">₹{v.price}</span>
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CounterOrder;
