import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Award, Star } from "lucide-react";

const StaffPerformance = () => {
  const { hotelId } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    Promise.all([
      supabase.from("profiles").select("user_id, full_name, role").eq("hotel_id", hotelId),
      supabase.from("orders").select("waiter_id, total, status").eq("hotel_id", hotelId).eq("status", "billed"),
    ]).then(([staffRes, ordersRes]) => {
      setStaff((staffRes.data || []).filter((s: any) => s.role !== "owner"));
      setOrders(ordersRes.data || []);
      setLoading(false);
    });
  }, [hotelId]);

  const statsMap = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    orders.forEach((o: any) => {
      if (!map[o.waiter_id]) map[o.waiter_id] = { count: 0, total: 0 };
      map[o.waiter_id].count++;
      map[o.waiter_id].total += Number(o.total) || 0;
    });
    return map;
  }, [orders]);

  const sorted = useMemo(() =>
    [...staff].sort((a, b) => (statsMap[b.user_id]?.total || 0) - (statsMap[a.user_id]?.total || 0)),
  [staff, statsMap]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Staff Performance</h1>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No staff data available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s, idx) => {
            const stats = statsMap[s.user_id] || { count: 0, total: 0 };
            const avgOrder = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
            return (
              <Card key={s.user_id} className="glass-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 font-bold text-primary text-lg">
                    {idx < 3 ? <Award className="h-5 w-5" /> : (s.full_name || "S")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold flex items-center gap-2">
                      {s.full_name || "Unknown"}
                      <Badge variant="outline" className="capitalize text-[10px]">{s.role}</Badge>
                      {idx === 0 && stats.count > 0 && <Badge className="bg-yellow-500/20 text-yellow-700 text-[10px]">🏆 Top</Badge>}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>{stats.count} orders</span>
                      <span>₹{stats.total.toLocaleString()} revenue</span>
                      <span>Avg ₹{avgOrder}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffPerformance;
