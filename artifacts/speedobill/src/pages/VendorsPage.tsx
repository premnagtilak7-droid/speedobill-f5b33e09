import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Truck, Plus, Phone, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VendorsPage = () => {
  const { hotelId } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", category: "General", notes: "" });

  const fetchVendors = async () => {
    if (!hotelId) return;
    const { data } = await supabase.from("vendors").select("*").eq("hotel_id", hotelId).order("name");
    setVendors(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchVendors(); }, [hotelId]);

  const addVendor = async () => {
    if (!form.name.trim() || !hotelId) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("vendors").insert({ hotel_id: hotelId, name: form.name.trim(), contact: form.contact, category: form.category, notes: form.notes });
    if (error) toast.error(error.message);
    else { toast.success("Vendor added"); setAddOpen(false); setForm({ name: "", contact: "", category: "General", notes: "" }); fetchVendors(); }
  };

  const deleteVendor = async (id: string) => {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Vendor removed"); fetchVendors(); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Vendors</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Vendor</Button>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No vendors added yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {vendors.map(v => (
            <Card key={v.id} className="glass-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{v.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-[10px]">{v.category}</Badge>
                    {v.contact && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.contact}</span>}
                  </div>
                  {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteVendor(v.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Vendor name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Contact (phone)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Vegetables">Vegetables</SelectItem>
                <SelectItem value="Dairy">Dairy</SelectItem>
                <SelectItem value="Meat">Meat</SelectItem>
                <SelectItem value="Spices">Spices</SelectItem>
                <SelectItem value="Packaging">Packaging</SelectItem>
                <SelectItem value="Equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <Button className="w-full" onClick={addVendor}>Save Vendor</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorsPage;
