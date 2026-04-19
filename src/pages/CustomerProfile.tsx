import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, Cake, Crown, Star, Award, ShoppingBag, Receipt, Heart, Gift } from "lucide-react";
import { format, parseISO } from "date-fns";

const isVIP = (visits: number, spend: number) => visits >= 10 || spend >= 5000;

const CustomerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { hotelId } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !hotelId) return;
    (async () => {
      setLoading(true);
      const [cRes, oRes, fRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).eq("hotel_id", hotelId).maybeSingle(),
        supabase
          .from("orders")
          .select("id, total, status, created_at, billed_at, payment_method, table_id, order_items(name, quantity, price)")
          .eq("hotel_id", hotelId)
          .eq("customer_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("customer_feedback").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      ]);
      setCustomer(cRes.data);
      setOrders(oRes.data || []);
      setFeedback(fRes.data || []);
      setLoading(false);
    })();
  }, [id, hotelId]);

  const stats = useMemo(() => {
    const total_spend = orders.filter((o) => o.status === "billed").reduce((s, o) => s + Number(o.total), 0);
    const total_visits = orders.filter((o) => o.status === "billed").length;
    const favItems: Record<string, number> = {};
    orders.forEach((o) => (o.order_items || []).forEach((i: any) => {
      favItems[i.name] = (favItems[i.name] || 0) + Number(i.quantity);
    }));
    const top = Object.entries(favItems).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const avgRating = feedback.length > 0
      ? (feedback.reduce((s, f) => s + Number(f.rating), 0) / feedback.length).toFixed(1)
      : "—";
    return { total_spend, total_visits, top, avgRating };
  }, [orders, feedback]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  if (!customer) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Card className="mt-4"><CardContent className="p-8 text-center text-muted-foreground">Customer not found</CardContent></Card>
      </div>
    );
  }

  const visits = customer.total_visits ?? stats.total_visits;
  const spend = Number(customer.total_spend ?? stats.total_spend);
  const vip = isVIP(visits, spend);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
        <div className="relative px-5 md:px-7 py-6"
          style={{
            background: "linear-gradient(135deg, hsl(222 39% 16%) 0%, hsl(240 33% 10%) 100%)",
            border: "1px solid hsl(var(--primary) / 0.18)",
          }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold ring-2 ring-primary/40">
                {(customer.name || "?")[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
                  {customer.name}
                  {vip && (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 gap-1">
                      <Crown className="h-3 w-3" /> VIP
                    </Badge>
                  )}
                </h1>
                <div className="flex items-center gap-3 text-sm text-white/60 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>
                  {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
                  {customer.birthday && (
                    <span className="flex items-center gap-1"><Cake className="h-3.5 w-3.5" />{format(parseISO(customer.birthday), "dd MMM")}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50 uppercase tracking-wider">Member since</p>
              <p className="text-sm font-semibold text-white">{format(parseISO(customer.created_at), "MMM yyyy")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-extrabold tnum">{customer.loyalty_points || 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Loyalty pts</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <ShoppingBag className="h-5 w-5 mx-auto text-sky-400 mb-1" />
            <p className="text-2xl font-extrabold tnum">{visits}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Total visits</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Receipt className="h-5 w-5 mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-extrabold tnum">₹{spend.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Lifetime spend</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-400 mb-1" />
            <p className="text-2xl font-extrabold tnum">⭐ {stats.avgRating}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Avg rating</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Visit history */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Visit History</CardTitle></CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No visits yet</p>
            ) : (
              <div className="divide-y divide-border/40 max-h-[440px] overflow-y-auto">
                {orders.map((o) => (
                  <div key={o.id} className="p-3 flex items-center justify-between hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {format(parseISO(o.billed_at || o.created_at), "dd MMM yyyy · hh:mm a")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {(o.order_items || []).length} items · {o.payment_method || "—"} ·{" "}
                        <span className={`uppercase font-semibold ${o.status === "billed" ? "text-emerald-400" : "text-amber-400"}`}>
                          {o.status}
                        </span>
                      </p>
                    </div>
                    <span className="font-bold text-sm tnum">₹{Number(o.total).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {stats.top.length > 0 && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-rose-400" /> Favorite items</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {stats.top.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{name}</span>
                    <Badge variant="outline" className="text-[10px] tnum">{count}×</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {customer.dietary_preferences && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Preferences</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{customer.dietary_preferences}</p></CardContent>
            </Card>
          )}

          {customer.notes && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">📝 Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p></CardContent>
            </Card>
          )}

          {feedback.length > 0 && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" /> Feedback</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {feedback.slice(0, 5).map((f) => (
                  <div key={f.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>{"⭐".repeat(f.rating)}</span>
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(f.created_at), "dd MMM")}</span>
                    </div>
                    {f.comment && <p className="text-xs text-muted-foreground mt-1">{f.comment}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
