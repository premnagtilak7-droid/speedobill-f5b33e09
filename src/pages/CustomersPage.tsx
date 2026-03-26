import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Search, Plus, Gift, Phone, Mail, Calendar, Star,
  Download, Edit2, Trash2, ShoppingBag, Clock, ChevronRight,
  Heart, UserPlus, Filter, X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  loyalty_points: number;
  birthday: string | null;
  dietary_preferences: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderSummary {
  id: string;
  total: number;
  created_at: string;
  status: string;
  payment_method: string;
  items: { name: string; quantity: number; price: number }[];
}

type Segment = "all" | "vip" | "regular" | "new" | "birthday";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const CustomersPage = () => {
  const { hotelId, role } = useAuth();
  const isOwner = role === "owner";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formBirthday, setFormBirthday] = useState("");
  const [formDietary, setFormDietary] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ── fetch customers ── */
  const fetchCustomers = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data || []) as Customer[]);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);

  /* ── fetch order history for a customer ── */
  const fetchOrderHistory = useCallback(async (customerId: string) => {
    if (!hotelId) return;
    setHistoryLoading(true);
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, created_at, status, payment_method")
      .eq("hotel_id", hotelId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20);

    const summaries: OrderSummary[] = [];
    for (const o of orders || []) {
      const { data: items } = await supabase
        .from("order_items")
        .select("name, quantity, price")
        .eq("order_id", o.id);
      summaries.push({ ...o, total: Number(o.total), items: (items || []) as any });
    }
    setOrderHistory(summaries);
    setHistoryLoading(false);
  }, [hotelId]);

  /* ── segmentation ── */
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = customers;

    // Segment filter
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    if (segment === "vip") list = list.filter(c => c.loyalty_points >= 100);
    else if (segment === "regular") list = list.filter(c => c.loyalty_points >= 10 && c.loyalty_points < 100);
    else if (segment === "new") list = list.filter(c => c.created_at >= sevenDaysAgo);
    else if (segment === "birthday") {
      list = list.filter(c => {
        if (!c.birthday) return false;
        const bMonth = new Date(c.birthday).getMonth() + 1;
        return bMonth === currentMonth;
      });
    }

    // Search filter
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [customers, searchQuery, segment]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter(c => c.loyalty_points >= 100).length;
    const totalPoints = customers.reduce((s, c) => s + c.loyalty_points, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newThisWeek = customers.filter(c => c.created_at >= sevenDaysAgo).length;
    return { total, vip, totalPoints, newThisWeek };
  }, [customers]);

  /* ── add/edit customer ── */
  const openAddDialog = () => {
    setEditingCustomer(null);
    setFormName(""); setFormPhone(""); setFormEmail(""); setFormBirthday(""); setFormDietary(""); setFormNotes("");
    setDialogOpen(true);
  };

  const openEditDialog = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name); setFormPhone(c.phone); setFormEmail(c.email || "");
    setFormBirthday(c.birthday || ""); setFormDietary(c.dietary_preferences || ""); setFormNotes(c.notes || "");
    setDialogOpen(true);
  };

  const saveCustomer = async () => {
    if (!hotelId || !formName.trim() || !formPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const payload = {
      hotel_id: hotelId,
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || null,
      birthday: formBirthday || null,
      dietary_preferences: formDietary.trim() || null,
      notes: formNotes.trim() || null,
    };

    if (editingCustomer) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editingCustomer.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Customer updated");
    } else {
      const { error } = await supabase.from("customers").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Customer added");
    }
    setDialogOpen(false);
    await fetchCustomers();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Customer deleted");
    if (selectedCustomer?.id === id) setSelectedCustomer(null);
    await fetchCustomers();
  };

  /* ── CSV Export ── */
  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "Loyalty Points", "Birthday", "Dietary Preferences", "Notes", "Joined"];
    const rows = filtered.map(c => [
      c.name, c.phone, c.email || "", String(c.loyalty_points), c.birthday || "",
      c.dietary_preferences || "", c.notes || "",
      new Date(c.created_at).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  /* ── select customer for detail ── */
  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    void fetchOrderHistory(c.id);
  };

  const getSegmentBadge = (c: Customer) => {
    if (c.loyalty_points >= 100) return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px]"><Star className="h-3 w-3 mr-0.5" />VIP</Badge>;
    if (c.loyalty_points >= 10) return <Badge variant="secondary" className="text-[10px]">Regular</Badge>;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (c.created_at >= sevenDaysAgo) return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">New</Badge>;
    return null;
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Customer Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage customers, loyalty points & order history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {isOwner && (
            <Button size="sm" onClick={openAddDialog}>
              <UserPlus className="h-4 w-4 mr-1" /> Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Customers", value: stats.total, icon: Users, color: "text-primary" },
          { label: "VIP Customers", value: stats.vip, icon: Star, color: "text-amber-500" },
          { label: "Total Loyalty Points", value: stats.totalPoints, icon: Gift, color: "text-emerald-500" },
          { label: "New This Week", value: stats.newThisWeek, icon: UserPlus, color: "text-blue-500" },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2 bg-muted ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + Segment Tabs */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..." className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: "all", label: "All", icon: Users },
            { key: "vip", label: "VIP", icon: Star },
            { key: "regular", label: "Regular", icon: Heart },
            { key: "new", label: "New", icon: UserPlus },
            { key: "birthday", label: "🎂 Birthday", icon: Calendar },
          ] as { key: Segment; label: string; icon: any }[]).map(s => (
            <Button key={s.key} size="sm" variant={segment === s.key ? "default" : "outline"}
              onClick={() => setSegment(s.key)} className="h-8 text-xs">
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content: List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-xl p-10 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No customers found</p>
              {isOwner && <Button size="sm" className="mt-3" onClick={openAddDialog}><Plus className="h-4 w-4 mr-1" /> Add First Customer</Button>}
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((c, idx) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => selectCustomer(c)}
                  className={`glass-card rounded-xl p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${selectedCustomer?.id === c.id ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{c.name}</p>
                          {getSegmentBadge(c)}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                          {c.email && <span className="flex items-center gap-1 hidden sm:flex"><Mail className="h-3 w-3" />{c.email}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                          <Gift className="h-3.5 w-3.5 text-primary" />{c.loyalty_points}
                        </div>
                        <p className="text-[10px] text-muted-foreground">points</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {(c.birthday || c.dietary_preferences) && (
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      {c.birthday && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(c.birthday).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                      {c.dietary_preferences && <Badge variant="outline" className="text-[10px]">{c.dietary_preferences}</Badge>}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Customer Detail Panel */}
        <div className="lg:col-span-1">
          {selectedCustomer ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-5 sticky top-24 space-y-4">
              {/* Profile Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{selectedCustomer.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{selectedCustomer.phone}</p>
                    {selectedCustomer.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{selectedCustomer.email}</p>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedCustomer(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Loyalty & Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <Gift className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-xl font-bold text-foreground">{selectedCustomer.loyalty_points}</p>
                  <p className="text-[10px] text-muted-foreground">Loyalty Points</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-bold text-foreground">{new Date(selectedCustomer.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</p>
                  <p className="text-[10px] text-muted-foreground">Member Since</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-xs">
                {selectedCustomer.birthday && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Birthday: {new Date(selectedCustomer.birthday).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</span>
                  </div>
                )}
                {selectedCustomer.dietary_preferences && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Heart className="h-3.5 w-3.5" />
                    <span>Diet: {selectedCustomer.dietary_preferences}</span>
                  </div>
                )}
                {selectedCustomer.notes && (
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-muted-foreground">
                    📝 {selectedCustomer.notes}
                  </div>
                )}
              </div>

              {/* Actions */}
              {isOwner && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditDialog(selectedCustomer)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => deleteCustomer(selectedCustomer.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Order History */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Order History
                </h4>
                {historyLoading ? (
                  <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
                ) : orderHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No orders yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {orderHistory.map(o => (
                      <div key={o.id} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">{formatCurrency(o.total)}</span>
                          <Badge variant={o.status === "billed" ? "default" : "secondary"} className="text-[10px]">{o.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          {" · "}{o.payment_method} · {o.items.length} items
                        </p>
                        {o.items.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                            {o.items.map(i => `${i.name}×${i.quantity}`).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center sticky top-24">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select a customer to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Customer name" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Phone *</label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Email</label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email (optional)" type="email" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Birthday</label>
              <Input value={formBirthday} onChange={(e) => setFormBirthday(e.target.value)} type="date" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Dietary Preferences</label>
              <Input value={formDietary} onChange={(e) => setFormDietary(e.target.value)} placeholder="e.g. Vegetarian, No onion/garlic" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Notes</label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any special notes..." rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveCustomer}>{editingCustomer ? "Update" : "Add Customer"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersPage;
