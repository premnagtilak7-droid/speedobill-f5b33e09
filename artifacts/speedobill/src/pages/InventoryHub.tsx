import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Plus, Trash2, AlertTriangle } from "lucide-react";

const InventoryHub = () => {
  const { hotelId } = useAuth();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [adding, setAdding] = useState(false);

  const fetch = async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data } = await supabase.from("ingredients").select("*").eq("hotel_id", hotelId).order("name");
    setIngredients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [hotelId]);

  const addIngredient = async () => {
    if (!name.trim() || !hotelId) return;
    setAdding(true);
    const { data, error } = await supabase.from("ingredients").insert({
      hotel_id: hotelId, name: name.trim(), unit,
      current_stock: parseFloat(stock) || 0,
      min_threshold: parseFloat(threshold) || 0,
    }).select().single();
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success("Ingredient added");
      setName(""); setStock("");
      if (data) setIngredients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      else fetch();
    }
    setAdding(false);
  };

  const deleteIngredient = async (id: string) => {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else { toast.success("Deleted"); setIngredients(prev => prev.filter(i => i.id !== id)); }
  };

  const getStatus = (current: number, min: number) => {
    if (current === 0) return { label: "Critical", className: "bg-destructive/20 text-destructive border-destructive/40" };
    if (current <= min) return { label: "Low", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40" };
    return { label: "OK", className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" };
  };

  const lowStock = ingredients.filter(i => Number(i.current_stock) <= Number(i.min_threshold));
  const criticalCount = ingredients.filter(i => Number(i.current_stock) === 0).length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Inventory Hub</h1>

      {(lowStock.length > 0 || criticalCount > 0) && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium">
              {criticalCount > 0 && <span className="text-destructive">{criticalCount} critical (out of stock)</span>}
              {criticalCount > 0 && lowStock.length > criticalCount && " · "}
              {lowStock.length > criticalCount && `${lowStock.length - criticalCount} low stock`}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Add Ingredient</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rice" />
            </div>
            <div className="space-y-1 w-20">
              <label className="text-xs text-muted-foreground">Unit</label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="g/kg/L" />
            </div>
            <div className="space-y-1 w-24">
              <label className="text-xs text-muted-foreground">Stock</label>
              <Input type="number" value={stock} onChange={e => setStock(e.target.value)} />
            </div>
            <div className="space-y-1 w-24">
              <label className="text-xs text-muted-foreground">Min</label>
              <Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} />
            </div>
            <Button onClick={addIngredient} disabled={adding || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ingredients ({ingredients.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Unit</th>
                  <th className="text-right p-3 font-medium">Stock</th>
                  <th className="text-right p-3 font-medium">Min</th>
                  <th className="text-right p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loading && ingredients.map(i => {
                  const status = getStatus(Number(i.current_stock), Number(i.min_threshold));
                  return (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{i.name}</td>
                      <td className="p-3 text-muted-foreground">{i.unit}</td>
                      <td className="p-3 text-right">{i.current_stock}</td>
                      <td className="p-3 text-right text-muted-foreground">{i.min_threshold}</td>
                      <td className="p-3 text-right">
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteIngredient(i.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && ingredients.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No ingredients yet. Add your first one above to start tracking stock.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryHub;
