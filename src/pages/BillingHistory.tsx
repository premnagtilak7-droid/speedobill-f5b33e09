import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, CalendarDays, Printer, MessageCircle, Share2, IndianRupee, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format, subDays } from "date-fns";

type RangeKey = "today" | "7days" | "30days" | "all" | "custom";

interface BilledOrder {
  id: string;
  total: number;
  created_at: string;
  billed_at: string;
  table_number: number;
  waiter_name: string;
  payment_method: string;
  discount_percent: number;
  items: { name: string; price: number; quantity: number }[];
}

const BillingHistory = () => {
  const { hotelId } = useAuth();
  const [orders, setOrders] = useState<BilledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState<RangeKey>("30days");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hotelInfo, setHotelInfo] = useState<{ name: string; address: string; phone: string; tax_percent: number; gst_enabled: boolean } | null>(null);

  const fetchBills = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);

    let query = supabase
      .from("orders")
      .select("id, total, created_at, billed_at, table_id, waiter_id, payment_method, discount_percent")
      .eq("hotel_id", hotelId)
      .eq("status", "billed")
      .not("billed_at", "is", null)
      .order("billed_at", { ascending: false })
      .limit(500);

    if (rangeKey === "today") {
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("billed_at", `${today}T00:00:00.000Z`).lte("billed_at", `${today}T23:59:59.999Z`);
    } else if (rangeKey === "7days") {
      query = query.gte("billed_at", subDays(new Date(), 7).toISOString());
    } else if (rangeKey === "30days") {
      query = query.gte("billed_at", subDays(new Date(), 30).toISOString());
    } else if (rangeKey === "custom") {
      query = query
        .gte("billed_at", `${selectedDate}T00:00:00.000Z`)
        .lte("billed_at", `${selectedDate}T23:59:59.999Z`);
    }
    // "all" → no extra filter

    const { data: ordersData } = await query;

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const tableIds = [...new Set(ordersData.map((o) => o.table_id))];
    const waiterIds = [...new Set(ordersData.map((o) => o.waiter_id))];
    const orderIds = ordersData.map((o) => o.id);

    const [tablesRes, profilesRes, itemsRes] = await Promise.all([
      supabase.from("restaurant_tables").select("id, table_number").in("id", tableIds),
      supabase.from("profiles").select("user_id, full_name").in("user_id", waiterIds),
      supabase.from("order_items").select("order_id, name, price, quantity").in("order_id", orderIds),
    ]);

    const tableMap = new Map(tablesRes.data?.map((t) => [t.id, t.table_number]) || []);
    const waiterMap = new Map(profilesRes.data?.map((p) => [p.user_id, p.full_name || "Staff"]) || []);
    const itemsMap = new Map<string, { name: string; price: number; quantity: number }[]>();
    itemsRes.data?.forEach((item) => {
      if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
      itemsMap.get(item.order_id)!.push({ name: item.name, price: item.price, quantity: item.quantity });
    });

    const enriched: BilledOrder[] = ordersData.map((o: any) => ({
      id: o.id,
      total: o.total,
      created_at: o.created_at,
      billed_at: o.billed_at,
      table_number: tableMap.get(o.table_id) || 0,
      waiter_name: waiterMap.get(o.waiter_id) || "Staff",
      payment_method: o.payment_method || "cash",
      discount_percent: o.discount_percent || 0,
      items: itemsMap.get(o.id) || [],
    }));

    setOrders(enriched);
    setLoading(false);
  }, [hotelId, selectedDate]);

  useEffect(() => {
    if (hotelId) {
      supabase.from("hotels").select("name, address, phone, tax_percent, gst_enabled").eq("id", hotelId).maybeSingle().then(({ data }) => {
        if (data) setHotelInfo(data as any);
      });
    }
  }, [hotelId]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const buildReceipt = (order: BilledOrder) => {
    const lines: string[] = [];
    lines.push("═".repeat(32));
    lines.push(hotelInfo?.name?.toUpperCase() || "RESTAURANT");
    if (hotelInfo?.address) lines.push(hotelInfo.address);
    if (hotelInfo?.phone) lines.push(`Tel: ${hotelInfo.phone}`);
    lines.push("═".repeat(32));
    lines.push(`Bill #: ${order.id.slice(0, 8).toUpperCase()}`);
    lines.push(`Table: ${order.table_number}  |  ${order.payment_method.toUpperCase()}`);
    lines.push(`Date: ${format(new Date(order.billed_at), "dd/MM/yyyy hh:mm a")}`);
    lines.push(`Served by: ${order.waiter_name}`);
    lines.push("─".repeat(32));
    lines.push("Item                 Qty  Amount");
    lines.push("─".repeat(32));
    order.items.forEach((item) => {
      const name = item.name.padEnd(20).slice(0, 20);
      const qty = String(item.quantity).padStart(3);
      const amt = `₹${(item.price * item.quantity).toFixed(0)}`.padStart(7);
      lines.push(`${name} ${qty} ${amt}`);
    });
    lines.push("─".repeat(32));
    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    lines.push(`Subtotal:              ₹${subtotal.toFixed(0)}`);
    if (order.discount_percent > 0) {
      lines.push(`Discount (${order.discount_percent}%):      -₹${(subtotal * order.discount_percent / 100).toFixed(0)}`);
    }
    if (hotelInfo?.gst_enabled && hotelInfo.tax_percent > 0) {
      const taxable = subtotal * (1 - order.discount_percent / 100);
      const tax = taxable * (hotelInfo.tax_percent / 100);
      lines.push(`GST (${hotelInfo.tax_percent}%):             ₹${tax.toFixed(0)}`);
    }
    lines.push("═".repeat(32));
    lines.push(`TOTAL:                 ₹${Number(order.total).toFixed(0)}`);
    lines.push("═".repeat(32));
    lines.push("        Thank you! Visit again.");
    return lines.join("\n");
  };

  const handlePrint = (order: BilledOrder) => {
    const text = buildReceipt(order);
    const w = window.open("", "_blank", "width=350,height=600");
    if (w) {
      w.document.write(`<html><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:11px;white-space:pre-wrap;padding:8px;line-height:1.5;}</style></head><body>${text}</body></html>`);
      w.document.close();
      w.print();
    }
  };

  const handleWhatsApp = (order: BilledOrder) => {
    const text = buildReceipt(order);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShare = async (order: BilledOrder) => {
    const text = buildReceipt(order);
    if (navigator.share) {
      try { await navigator.share({ title: `Bill - Table ${order.table_number}`, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Receipt copied!");
    }
  };

  const paymentBadge = (method: string) => {
    const colors: Record<string, string> = {
      cash: "bg-green-500/15 text-green-600",
      card: "bg-blue-500/15 text-blue-600",
      upi: "bg-purple-500/15 text-purple-600",
    };
    return colors[method] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Billing History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">All completed bills with thermal-style receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              <IndianRupee className="h-5 w-5" />{totalRevenue.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{orders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Bills Generated</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              <IndianRupee className="h-4 w-4" />{avgOrderValue.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Avg Bill Value</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bills generated for {format(new Date(selectedDate), "dd MMM yyyy")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">T{order.table_number}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">Table {order.table_number}</span>
                        <Badge variant="outline" className={`text-[10px] capitalize ${paymentBadge(order.payment_method)}`}>
                          {order.payment_method}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">by {order.waiter_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(order.billed_at), "hh:mm a")}
                        {order.discount_percent > 0 && (
                          <Badge variant="secondary" className="text-[9px] ml-1">-{order.discount_percent}%</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-primary flex items-center">₹{Number(order.total).toFixed(0)}</span>
                    {expanded === order.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {expanded === order.id && (
                  <div className="px-4 pb-4 border-t space-y-3">
                    <div className="pt-3 space-y-1.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                          <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-dashed">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handlePrint(order)}>
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleWhatsApp(order)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleShare(order)}>
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingHistory;
