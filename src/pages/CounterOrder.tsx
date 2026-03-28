import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Store, Plus, Minus, ShoppingCart, Trash2 } from "lucide-react";

interface PriceVariant { label: string; price: number; }
interface CartItem {
  id: string;
  key: string;
  name: string;
  price: number;
  qty: number;
}

const CounterOrder = () => {
  const { user, hotelId } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [variantItem, setVariantItem] = useState<any>(null);

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const [menuRes, profRes] = await Promise.all([
        supabase.from("menu_items").select("*").eq("hotel_id", hotelId).eq("is_available", true).order("category"),
        supabase.from("profiles").select("full_name").eq("user_id", user?.id).maybeSingle(),
      ]);
      setMenuItems(menuRes.data || []);
      setProfile(profRes.data);
      setLoading(false);
    })();
  }, [hotelId, user]);

  const handleItemClick = (item: any) => {
    const variants = ((item.price_variants as PriceVariant[] | null) || []).filter(v => v.label && v.price > 0);
    if (variants.length > 0) {
      setVariantItem(item);
    } else {
      addToCart(item.id, item.name, item.price);
    }
  };

  const addToCart = (itemId: string, name: string, price: number, variantLabel?: string) => {
    const key = variantLabel ? `${itemId}-${variantLabel}` : itemId;
    const displayName = variantLabel ? `${name} (${variantLabel})` : name;
    setCart(prev => {
      const existing = prev.find(c => c.key === key);
      if (existing) return prev.map(c => c.key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: itemId, key, name: displayName, price, qty: 1 }];
    });
  };

  const updateQty = (key: string, delta: number) => {
    setCart(prev => prev.map(c => c.key === key ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
  };

  const removeFromCart = (key: string) => setCart(prev => prev.filter(c => c.key !== key));

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const placeOrder = async () => {
    if (!cart.length || !hotelId || !user) return;
    setPlacing(true);
    const { data: tokenNum } = await supabase.rpc("next_token_number", { _hotel_id: hotelId });

    const { error } = await supabase.from("counter_orders").insert({
      hotel_id: hotelId,
      waiter_id: user.id,
      waiter_name: profile?.full_name || "",
      token_number: tokenNum || 0,
      total_amount: total,
      items: cart.map(c => ({ name: c.name, price: c.price, qty: c.qty })),
    });

    if (error) toast.error("Order failed: " + error.message);
    else {
      toast.success(`Token #${tokenNum} — ₹${total.toFixed(0)}`);
      setCart([]);
    }
    setPlacing(false);
  };

  const filtered = menuItems.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><Store className="h-6 w-6" /> Counter Order</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Menu */}
        <div className="lg:col-span-2 space-y-3">
          <Input placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filtered.map(item => {
              const variants = ((item.price_variants as PriceVariant[] | null) || []).filter((v: PriceVariant) => v.label && v.price > 0);
              const hasVariants = variants.length > 0;
              const priceLabel = hasVariants ? `₹${Math.min(...variants.map((v: PriceVariant) => v.price))}+` : `₹${item.price}`;
              const qty = cart.filter(c => c.key.startsWith(item.id)).reduce((s, c) => s + c.qty, 0);
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="relative p-3 rounded-lg border bg-card hover:bg-accent/50 text-left transition-colors"
                >
                  {qty > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </div>
                  )}
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                  <p className="text-sm font-bold text-primary mt-1">{priceLabel}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <Card className="h-fit sticky top-4">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Cart ({cart.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tap items to add</p>}
            {cart.map(c => (
              <div key={c.key} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">₹{c.price} × {c.qty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.key, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center text-sm">{c.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.key, 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(c.key)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <div className="border-t pt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>
                <Button className="w-full" onClick={placeOrder} disabled={placing}>
                  {placing ? "Placing..." : "Place Order & Print Token"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Variant Picker */}
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
