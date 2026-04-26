import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShoppingBag,
  Bell,
  Clock,
  Volume2,
  Copy,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Mail,
  Zap,
} from "lucide-react";

interface DirectOrder {
  id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: Array<{ name: string; quantity: number; price: number }>;
  total_amount: number;
  status: string;
  created_at: string;
}

const COMING_SOON_MESSAGE = `Zomato/Swiggy integration coming soon!

We are working on official API partnership.
You will be notified when available.

Contact: speedobill7@gmail.com`;

const OnlineOrders = () => {
  const { hotelId } = useAuth();
  const [orders, setOrders] = useState<DirectOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const menuLink = hotelId
    ? `${window.location.origin}/menu/${hotelId}`
    : "";

  const fetchOrders = useCallback(async () => {
    if (!hotelId) return;
    const { data, error } = await supabase
      .from("customer_orders")
      .select("id, table_number, customer_name, customer_phone, items, total_amount, status, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setOrders(
        (data as any[]).map((o) => ({
          ...o,
          items: Array.isArray(o.items) ? o.items : [],
        })),
      );
    }
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    fetchOrders();
    if (!hotelId) return;

    const channel = supabase
      .channel(`online-orders-${hotelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: `hotel_id=eq.${hotelId}`,
        },
        () => fetchOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotelId, fetchOrders]);

  const handleComingSoon = (platform: string) => {
    toast(`${platform} integration coming soon!`, {
      description: "We're working on official API partnership. Contact speedobill7@gmail.com",
      duration: 6000,
    });
  };

  const copyMenuLink = async () => {
    try {
      await navigator.clipboard.writeText(menuLink);
      toast.success("Menu link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const incomingCount = orders.filter((o) => o.status === "incoming").length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" /> Online Orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage online ordering channels and direct customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          {incomingCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground animate-pulse gap-1">
              <Bell className="h-3 w-3" /> {incomingCount} incoming
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle sound"
          >
            <Volume2
              className={`h-4 w-4 ${soundEnabled ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>
        </div>
      </div>

      {/* Integration cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Zomato */}
        <Card className="overflow-hidden border-2 hover:border-red-500/40 transition-colors">
          <div className="h-1.5 bg-red-500" />
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center text-red-600 font-extrabold text-lg">
                Z
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Coming Soon
              </Badge>
            </div>
            <div>
              <h3 className="font-bold text-base">Connect Zomato</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Receive Zomato orders directly in SpeedoBill
              </p>
            </div>
            <Button
              onClick={() => handleComingSoon("Zomato")}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Swiggy */}
        <Card className="overflow-hidden border-2 hover:border-orange-500/40 transition-colors">
          <div className="h-1.5 bg-orange-500" />
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-600 font-extrabold text-lg">
                S
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Coming Soon
              </Badge>
            </div>
            <div>
              <h3 className="font-bold text-base">Connect Swiggy</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Receive Swiggy orders directly in SpeedoBill
              </p>
            </div>
            <Button
              onClick={() => handleComingSoon("Swiggy")}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Direct */}
        <Card className="overflow-hidden border-2 border-primary/30 bg-primary/5">
          <div className="h-1.5 bg-primary" />
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] gap-1">
                <CheckCircle2 className="h-3 w-3" /> Active
              </Badge>
            </div>
            <div>
              <h3 className="font-bold text-base">Your Own Online Store</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Customers order directly from your SpeedoBill menu link
              </p>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                document
                  .getElementById("direct-orders")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View Orders
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Menu link share */}
      {hotelId && (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4 md:p-5 space-y-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  📱 Share your menu link with customers
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers can browse your menu and order directly — no app, no commission.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background rounded-lg p-2 border">
              <code className="text-xs flex-1 truncate font-mono text-foreground/80">
                {menuLink}
              </code>
              <Button size="sm" variant="ghost" onClick={copyMenuLink} className="gap-1 shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(menuLink, "_blank")}
                className="gap-1 shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Direct orders list */}
      <div id="direct-orders" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Direct Orders
          </h2>
          <span className="text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Loading orders…
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No direct orders yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Share your menu link above — orders will appear here in real time.
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const elapsed = Math.floor(
              (Date.now() - new Date(order.created_at).getTime()) / 60000,
            );
            return (
              <Card
                key={order.id}
                className={
                  order.status === "incoming"
                    ? "ring-2 ring-primary/50 animate-pulse"
                    : ""
                }
              >
                <div className="h-1 bg-primary" />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary/15 text-primary border border-primary/30 font-bold text-xs">
                        Direct Order
                      </Badge>
                      {order.table_number ? (
                        <span className="text-xs text-muted-foreground">
                          Table {order.table_number}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={order.status === "incoming" ? "destructive" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {order.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsed < 1 ? "Now" : `${elapsed}m`}
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {order.customer_name || "Guest"}
                      </p>
                      {order.customer_phone && (
                        <p className="text-xs text-muted-foreground">
                          {order.customer_phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>
                            {item.name} × {item.quantity}
                          </span>
                          <span className="font-medium">
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold border-t pt-1">
                        <span>Total</span>
                        <span>₹{Number(order.total_amount).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer contact */}
      <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-2">
        <Mail className="h-3 w-3" />
        Need aggregator integration? Contact{" "}
        <a
          href="mailto:speedobill7@gmail.com"
          className="text-primary hover:underline font-medium"
        >
          speedobill7@gmail.com
        </a>
      </div>
    </div>
  );
};

export default OnlineOrders;
