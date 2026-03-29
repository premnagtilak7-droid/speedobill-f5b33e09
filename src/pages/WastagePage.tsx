import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Plus, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

const WastagePage = () => {
  const { hotelId, user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ingredient_id: "", quantity: "", reason: "Spoiled" });

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const [logsRes, ingRes] = await Promise.all([
        supabase.from("wastage_logs").select("*").eq("hotel_id", hotelId).order("created_at", { ascending: false }).limit(200),
        supabase.from("ingredients").select("id, name, unit").eq("hotel_id", hotelId).order("name"),
      ]);
      setLogs(logsRes.data || []);
      setIngredients(ingRes.data || []);
      setLoading(false);
    })();
  }, [hotelId]);

  const addWastage = async () => {
    if (!form.ingredient_id || !form.quantity || !hotelId || !user) { toast.error("Fill all fields"); return; }
    const { error } = await supabase.from("wastage_logs").insert({
      hotel_id: hotelId,
      ingredient_id: form.ingredient_id,
      quantity: Number(form.quantity),
      reason: form.reason,
      logged_by: user.id,
      logged_by_name: user.user_metadata?.full_name || "Owner",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Wastage logged");
      setAddOpen(false);
      setForm({ ingredient_id: "", quantity: "", reason: "Spoiled" });
      const { data } = await supabase.from("wastage_logs").select("*").eq("hotel_id", hotelId).order("created_at", { ascending: false }).limit(200);
      setLogs(data || []);
    }
  };

  const ingMap = Object.fromEntries(ingredients.map(i => [i.id, i]));

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trash2 className="h-6 w-6 text-destructive" /> Wastage Log</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Wastage</Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No wastage records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <Card key={log.id} className="glass-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{ingMap[log.ingredient_id]?.name || "Unknown"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{log.quantity} {ingMap[log.ingredient_id]?.unit || ""}</span>
                    <Badge variant="secondary" className="text-[10px]">{log.reason}</Badge>
                    <span>by {log.logged_by_name}</span>
                    <span>{format(parseISO(log.created_at), "dd MMM, hh:mm a")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Wastage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.ingredient_id} onValueChange={v => setForm({ ...form, ingredient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger>
              <SelectContent>
                {ingredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Select value={form.reason} onValueChange={v => setForm({ ...form, reason: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Spoiled">Spoiled</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Dropped">Dropped</SelectItem>
                <SelectItem value="Over-cooked">Over-cooked</SelectItem>
                <SelectItem value="Customer Return">Customer Return</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={addWastage}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WastagePage;
