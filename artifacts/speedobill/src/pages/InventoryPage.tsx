import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Package, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const InventoryPage = () => {
  const { hotelId } = useAuth();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", unit: "g", current_stock: "0", min_threshold: "0" });

  const fetchIngredients = async () => {
    if (!hotelId) return;
    const { data } = await supabase.from("ingredients").select("*").eq("hotel_id", hotelId).order("name");
    setIngredients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchIngredients(); }, [hotelId]);

  const addIngredient = async () => {
    if (!form.name.trim() || !hotelId) { toast.error("Name required"); return; }
    const { error } = await supabase.from("ingredients").insert({
      hotel_id: hotelId, name: form.name.trim(), unit: form.unit,
      current_stock: Number(form.current_stock) || 0, min_threshold: Number(form.min_threshold) || 0,
    });
    if (error) toast.error(error.message);
    else { toast.success("Added"); setAddOpen(false); setForm({ name: "", unit: "g", current_stock: "0", min_threshold: "0" }); fetchIngredients(); }
  };

  const deleteIngredient = async (id: string) => {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchIngredients(); }
  };

  const updateStock = async (id: string, newStock: number) => {
    await supabase.from("ingredients").update({ current_stock: Math.max(0, newStock) }).eq("id", id);
    fetchIngredients();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const lowStock = ingredients.filter(i => i.min_threshold > 0 && i.current_stock <= i.min_threshold);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-primary" /> Inventory</h1>
        <div className="flex items-center gap-2">
          {lowStock.length > 0 && <Badge variant="destructive">{lowStock.length} low stock</Badge>}
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </div>

      {ingredients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No ingredients added yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ingredients.map(i => {
            const isLow = i.min_threshold > 0 && i.current_stock <= i.min_threshold;
            return (
              <Card key={i.id} className={`glass-card ${isLow ? "border-destructive/50" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {i.name}
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{i.current_stock} {i.unit} · Min: {i.min_threshold}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateStock(i.id, i.current_stock - 1)}>-</Button>
                      <span className="w-10 text-center text-sm font-mono">{i.current_stock}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateStock(i.id, i.current_stock + 1)}>+</Button>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => deleteIngredient(i.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ingredient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Unit (g, kg, L, pcs)" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            <Input type="number" placeholder="Current stock" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: e.target.value })} />
            <Input type="number" placeholder="Min threshold" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: e.target.value })} />
            <Button className="w-full" onClick={addIngredient}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
