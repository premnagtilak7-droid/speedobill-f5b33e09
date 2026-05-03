import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Store, Plus, Minus, ShoppingCart, Trash2, Printer, Receipt, Clock3, Hash, Search,
  Banknote, Smartphone, CreditCard,
} from "lucide-react";

interface PriceVariant { label: string; price: number; }
interface CartItem { id: string; key: string; name: string; price: number; qty: number; }
interface CounterOrderRow {
  id: string;
  token_number: number;
  total_amount: number;
  waiter_name: string | null;
  created_at: string;
  items: Array<{ name: string; price: number; qty: number }>;
}

const getTodayStartIso = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const isTodayOrder = (createdAt: string) => {
  const o = new Date(createdAt);
  const n = new Date();
  return o.getFullYear() === n.getFullYear() && o.getMonth() === n.getMonth() && o.getDate() === n.getDate();
};

// Stable category color (left border) — hashed to a small palette
const CATEGORY_COLORS = [
  "border-l-orange-500",
  "border-l-emerald-500",
  "border-l-sky-500",
  "border-l-violet-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-teal-500",
  "border-l-pink-500",
];
const colorForCategory = (cat: string) => {
  if (!cat) return CATEGORY_COLORS[0];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
};

const CounterOrder = () => {
  const { user, hotelId } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
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
    if (variants.length > 0) setVariantItem(item);
    else addToCart(item.id, item.name, item.price);
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
  const updateQty = (key: string, delta: number) =>
    setCart((p) => p.map((c) => (c.key === key ? { ...c, qty: Math.max(1, c.qty + delta) } : c)));
  const removeFromCart = (key: string) => setCart((p) => p.filter((c) => c.key !== key));

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart]);
  const gst = useMemo(() => subtotal * 0.05, [subtotal]);
  const total = useMemo(() => subtotal + gst, [subtotal, gst]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => m.category && set.add(m.category));
    return ["all", ...Array.from(set)];
  }, [menuItems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return menuItems.filter((m) => {
      const matchSearch = !q || m.name.toLowerCase().includes(q);
      const matchCat = activeCat === "all" || m.category === activeCat;
      return matchSearch && matchCat;
    });
  }, [menuItems, search, activeCat]);

  const latestToken = useMemo(() => {
    const today = recentOrders.find((o) => isTodayOrder(o.created_at));
    if (today) return today.token_number;
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
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      toast.success(`Token #${savedOrder.token_number} ready — ₹${total.toFixed(0)} (${paymentMethod.toUpperCase()})`);
      setLastPlacedOrder(savedOrder);
      setRecentOrders((prev) => [savedOrder, ...prev.filter((order) => order.id !== savedOrder.id)].slice(0, 12));
      setCart([]);
      setPaymentMethod("cash");
      handlePrintToken(savedOrder);
    }
    setPlacing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 animate-pop-in">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <span className="h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/30 flex items-center justify-center">
              <Store className="h-4 w-4 text-primary" />
            </span>
            Counter Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">Token-wise takeaway billing with instant print</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/60 text-xs font-semibold">
            <Receipt className="h-3.5 w-3.5 text-primary" /> Takeaway
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary">
            <Hash className="h-3.5 w-3.5" /> Today's Token {latestToken ? `#${latestToken}` : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* MENU SIDE */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-card border-border/60"
            />
          </div>

          {/* Category pills */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                    activeCat === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          )}

          {/* Menu cards: category color left border */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filtered.map((item) => {
              const variants = ((item.price_variants as PriceVariant[] | null) || []).filter((v: PriceVariant) => v.label && v.price > 0);
              const hasVariants = variants.length > 0;
              const priceLabel = hasVariants ? `₹${Math.min(...variants.map((v: PriceVariant) => v.price))}+` : `₹${item.price}`;
              const qty = cart.filter((c) => c.key.startsWith(item.id)).reduce((s, c) => s + c.qty, 0);
              const selected = qty > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`relative rounded-xl border-l-4 ${colorForCategory(item.category)} border-y border-r p-3 text-left transition-all duration-200 min-h-[100px] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.3)] ${
                    selected
                      ? "border-y-primary border-r-primary bg-primary/5"
                      : "border-y-border/60 border-r-border/60 bg-card"
                  }`}
                >
                  {selected && (
                    <div className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-primary px-1 text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
                      {qty}
                    </div>
                  )}
                  <p className="font-bold text-sm text-foreground line-clamp-2 leading-tight">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{item.category}</p>
                  <p className="text-base font-extrabold text-primary mt-2 tnum">{priceLabel}</p>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-12">No items match your search.</div>
            )}
          </div>
        </div>

        {/* CART SIDE */}
        <div className="space-y-4">
          <div className="sticky top-4 rounded-2xl border border-border/60 bg-card overflow-hidden">
            {/* Cart header */}
            <div className="px-4 py-3.5 border-b border-border/60 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Cart</h2>
              <span className="ml-auto inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {cart.reduce((s, c) => s + c.qty, 0)} items
              </span>
            </div>

            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Tap menu items to add</p>
              ) : (
                <>
                  {cart.map((c) => (
                    <div key={c.key} className="flex items-center gap-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground tnum">₹{c.price} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(c.key, -1)}
                          className="h-7 w-7 rounded-full bg-primary/15 text-primary hover:bg-primary/25 flex items-center justify-center transition-colors"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tnum">{c.qty}</span>
                        <button
                          onClick={() => updateQty(c.key, 1)}
                          className="h-7 w-7 rounded-full bg-primary/15 text-primary hover:bg-primary/25 flex items-center justify-center transition-colors"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="w-16 text-right text-sm font-bold text-foreground tnum">₹{(c.price * c.qty).toFixed(0)}</span>
                      <button
                        onClick={() => removeFromCart(c.key)}
                        className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="border-t border-border/60 pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tnum">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST (5%)</span>
                      <span className="tnum">₹{gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-2 text-base font-extrabold text-foreground">
                      <span>Total</span>
                      <span className="tnum text-primary">₹{total.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Payment method buttons */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      <PayBtn active={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} icon={Banknote} label="Cash" tone="emerald" />
                      <PayBtn active={paymentMethod === "upi"} onClick={() => setPaymentMethod("upi")} icon={Smartphone} label="UPI" tone="violet" />
                      <PayBtn active={paymentMethod === "card"} onClick={() => setPaymentMethod("card")} icon={CreditCard} label="Card" tone="sky" />
                    </div>
                  </div>

                  <Button
                    className="w-full min-h-[48px] gradient-btn-primary text-sm font-bold"
                    onClick={placeOrder}
                    disabled={placing}
                  >
                    {placing ? "Creating token…" : `Create Token & Print · ₹${total.toFixed(0)}`}
                  </Button>
                </>
              )}
            </div>
          </div>

          {lastPlacedOrder && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Last Printed Token</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-primary tnum leading-none">#{lastPlacedOrder.token_number}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{lastPlacedOrder.items.length} items</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-emerald-400 tnum">₹{Number(lastPlacedOrder.total_amount).toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <Clock3 className="h-3 w-3" />
                    {new Date(lastPlacedOrder.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full min-h-[40px] rounded-xl" onClick={() => handlePrintToken(lastPlacedOrder)}>
                <Printer className="h-4 w-4 mr-2" /> Reprint Last Token
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Recent tokens */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Recent Counter Tokens</h2>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No counter tokens yet.</p>
        ) : (
          <div className="grid gap-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/30 p-3 md:flex-row md:items-center md:justify-between transition-all hover:border-primary/40 hover:bg-background/50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-extrabold text-primary tnum">#{order.token_number}</span>
                    <span className="text-base font-bold text-emerald-400 tnum">₹{Number(order.total_amount).toFixed(0)}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-semibold">
                      {order.items.length} items
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {order.waiter_name || "Staff"} · {new Date(order.created_at).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </p>
                </div>
                <Button variant="outline" className="min-h-[40px] rounded-xl" onClick={() => handlePrintToken(order)}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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

function PayBtn({
  active, onClick, icon: Icon, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "emerald" | "violet" | "sky";
}) {
  const toneMap = {
    emerald: { bg: "bg-emerald-500", ring: "ring-emerald-500/40", text: "text-emerald-400", border: "border-emerald-500/30" },
    violet:  { bg: "bg-violet-500",  ring: "ring-violet-500/40",  text: "text-violet-400",  border: "border-violet-500/30" },
    sky:     { bg: "bg-sky-500",     ring: "ring-sky-500/40",     text: "text-sky-400",     border: "border-sky-500/30" },
  } as const;
  const t = toneMap[tone];
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
        active
          ? `${t.bg} text-white border-transparent shadow-md ring-2 ${t.ring}`
          : `bg-card ${t.border} ${t.text} hover:bg-background/50`
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

export default CounterOrder;
