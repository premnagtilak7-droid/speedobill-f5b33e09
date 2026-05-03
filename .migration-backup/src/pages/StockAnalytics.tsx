import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Package, TrendingDown, AlertTriangle, Trash2 } from "lucide-react";

const StockAnalytics = () => {
  const { hotelId } = useAuth();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [wastage, setWastage] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    Promise.all([
      supabase.from("ingredients").select("*").eq("hotel_id", hotelId).order("name"),
      supabase.from("wastage_logs").select("*").eq("hotel_id", hotelId).gte("created_at", thirtyAgo.toISOString()),
      supabase.from("purchase_logs").select("*").eq("hotel_id", hotelId).gte("purchased_at", thirtyAgo.toISOString()),
    ]).then(([ingRes, wastRes, purRes]) => {
      setIngredients(ingRes.data || []);
      setWastage(wastRes.data || []);
      setPurchases(purRes.data || []);
      setLoading(false);
    });
  }, [hotelId]);

  const totalWastageValue = useMemo(() => {
    return wastage.reduce((sum, w) => sum + Number(w.quantity), 0);
  }, [wastage]);

  const totalPurchaseValue = useMemo(() => {
    return purchases.reduce((sum, p) => sum + Number(p.total_cost), 0);
  }, [purchases]);

  const lowStock = ingredients.filter(i => i.min_threshold > 0 && i.current_stock <= i.min_threshold);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Stock Analytics (30 Days)</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <Package className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{ingredients.length}</p>
          <p className="text-xs text-muted-foreground">Ingredients</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
          <p className="text-2xl font-bold text-destructive">{lowStock.length}</p>
          <p className="text-xs text-muted-foreground">Low Stock</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Trash2 className="h-5 w-5 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold">{wastage.length}</p>
          <p className="text-xs text-muted-foreground">Wastage Entries</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <TrendingDown className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold">₹{totalPurchaseValue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Purchases</p>
        </CardContent></Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Low Stock Items</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lowStock.map(i => (
              <div key={i.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5">
                <span className="text-sm font-medium">{i.name}</span>
                <Badge variant="destructive" className="text-[10px]">{i.current_stock} {i.unit} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">All Ingredients</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-right p-3 font-medium">Stock</th>
                  <th className="text-right p-3 font-medium">Min</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map(i => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{i.name}</td>
                    <td className="p-3 text-right">{i.current_stock} {i.unit}</td>
                    <td className="p-3 text-right">{i.min_threshold}</td>
                    <td className="p-3 text-center">
                      <Badge variant={i.current_stock <= i.min_threshold && i.min_threshold > 0 ? "destructive" : "secondary"} className="text-[10px]">
                        {i.current_stock <= i.min_threshold && i.min_threshold > 0 ? "LOW" : "OK"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockAnalytics;
