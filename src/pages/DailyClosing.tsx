import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const DailyClosing = () => {
  const { hotelId } = useAuth();
  const [data, setData] = useState({ sales: 0, expenses: 0, orders: 0, counterOrders: 0 });
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      const [salesRes, expRes, ordersRes, counterRes] = await Promise.all([
        supabase.from("orders").select("total").eq("hotel_id", hotelId).eq("status", "billed").gte("created_at", startOfDay).lte("created_at", endOfDay),
        supabase.from("daily_expenses").select("amount").eq("hotel_id", hotelId).eq("expense_date", today),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).gte("created_at", startOfDay).lte("created_at", endOfDay),
        supabase.from("counter_orders").select("total_amount").eq("hotel_id", hotelId).gte("created_at", startOfDay).lte("created_at", endOfDay),
      ]);

      const totalSales = (salesRes.data || []).reduce((s, o) => s + Number(o.total), 0);
      const counterSales = (counterRes.data || []).reduce((s, o) => s + Number(o.total_amount), 0);
      const totalExpenses = (expRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

      setData({
        sales: totalSales + counterSales,
        expenses: totalExpenses,
        orders: ordersRes.count || 0,
        counterOrders: (counterRes.data || []).length,
      });
      setLoading(false);
    })();
  }, [hotelId]);

  const net = data.sales - data.expenses;

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarCheck className="h-6 w-6" /> Daily Closing</h1>
        <Badge variant="outline">{today}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">₹{data.sales.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">₹{data.expenses.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className={`text-2xl font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>₹{net.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Net Profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{data.orders + data.counterOrders}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span>Table Orders</span><span className="font-medium">{data.orders}</span></div>
          <div className="flex justify-between text-sm"><span>Counter Orders</span><span className="font-medium">{data.counterOrders}</span></div>
          <div className="flex justify-between text-sm border-t pt-2"><span>Dine-in Sales</span><span className="font-medium">₹{(data.sales - (data.sales > 0 ? 0 : 0)).toFixed(0)}</span></div>
          <div className="flex justify-between text-sm"><span>Total Expenses</span><span className="font-medium text-red-500">-₹{data.expenses.toFixed(0)}</span></div>
          <div className="flex justify-between text-sm border-t pt-2 font-bold"><span>Net</span><span className={net >= 0 ? "text-green-600" : "text-red-500"}>₹{net.toFixed(0)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyClosing;
