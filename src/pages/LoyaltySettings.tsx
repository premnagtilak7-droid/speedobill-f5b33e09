import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { Crown, Gift, Target, Banknote, Sparkles, Save } from "lucide-react";
import { motion } from "framer-motion";
import TopLoyaltyCustomers from "@/components/loyalty/TopLoyaltyCustomers";

const LoyaltySettings = () => {
  const { hotelId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    visit_goal: 10,
    reward_type: "percent_discount",
    reward_description: "10% Off",
    reward_value: 10,
    min_bill_value: 0,
  });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [redeemedThisMonth, setRedeemedThisMonth] = useState(0);

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      // Config
      const { data } = await supabase
        .from("hotel_loyalty_configs" as any)
        .select("*")
        .eq("hotel_id", hotelId)
        .maybeSingle();
      if (data) {
        setExistingId((data as any).id);
        setConfig({
          enabled: (data as any).enabled,
          visit_goal: (data as any).visit_goal,
          reward_type: (data as any).reward_type,
          reward_description: (data as any).reward_description,
          reward_value: (data as any).reward_value,
          min_bill_value: (data as any).min_bill_value,
        });
      }

      // Enrolled customers (any customer with loyalty_points > 0 or visit_count > 0)
      const { count: enrolled } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .or("loyalty_points.gt.0,visit_count.gt.0");
      setEnrolledCount(enrolled ?? 0);

      // Rewards claimed this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data: claimedRows } = await supabase
        .from("customers")
        .select("rewards_claimed, updated_at")
        .eq("hotel_id", hotelId)
        .gte("updated_at", monthStart.toISOString());
      const totalClaimed = (claimedRows || []).reduce(
        (sum, r: any) => sum + (Number(r.rewards_claimed) || 0),
        0
      );
      setRedeemedThisMonth(totalClaimed);

      setLoading(false);
    })();
  }, [hotelId]);

  const saveConfig = async () => {
    if (!hotelId) return;
    setSaving(true);
    const payload = { ...config, hotel_id: hotelId, updated_at: new Date().toISOString() };

    let error;
    if (existingId) {
      const res = await supabase.from("hotel_loyalty_configs" as any).update(payload).eq("id", existingId);
      error = res.error;
    } else {
      const res = await supabase.from("hotel_loyalty_configs" as any).insert(payload).select().single();
      error = res.error;
      if (!error && res.data) setExistingId((res.data as any).id);
    }

    if (error) toast.error("Save failed: " + error.message);
    else {
      toast.success("Loyalty settings saved!");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) void writeAudit({
        hotelId, action: "loyalty_updated", performedBy: user.id,
        performerName: user.email || null,
        details: `Loyalty ${config.enabled ? "enabled" : "disabled"} • ${config.visit_goal} visits • ${config.reward_description}`,
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" /> Loyalty Program
        </h1>
        <Badge variant={config.enabled ? "default" : "secondary"} className="text-sm">
          {config.enabled ? "✅ Active" : "❌ Disabled"}
        </Badge>
      </div>

      {/* Master Switch */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Enable Loyalty Program</p>
                  <p className="text-sm text-muted-foreground">Customers earn rewards based on visit count</p>
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Goal */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Visit Goal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">How many qualifying visits before a customer earns a reward?</p>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <Button
                  key={n}
                  variant={config.visit_goal === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConfig({ ...config, visit_goal: n })}
                >
                  {n} Visits
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-[200px]">
              <Input
                type="number"
                value={config.visit_goal}
                onChange={(e) => setConfig({ ...config, visit_goal: parseInt(e.target.value) || 5 })}
                min={2}
                max={100}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">visits</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reward Type */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Reward Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Reward Type</label>
              <Select value={config.reward_type} onValueChange={(v) => setConfig({ ...config, reward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent_discount">% Discount</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount Off (₹)</SelectItem>
                  <SelectItem value="free_item">Free Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  {config.reward_type === "percent_discount" ? "Discount %" : config.reward_type === "fixed_amount" ? "Amount (₹)" : "Value (for reference)"}
                </label>
                <Input
                  type="number"
                  value={config.reward_value}
                  onChange={(e) => setConfig({ ...config, reward_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Reward Description</label>
                <Input
                  placeholder="e.g. Free Mutton Handi, ₹200 Off"
                  value={config.reward_description}
                  onChange={(e) => setConfig({ ...config, reward_description: e.target.value })}
                />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-sm">
                <span className="font-medium">Preview:</span> After <strong>{config.visit_goal}</strong> qualifying visits, customer gets{" "}
                <strong className="text-primary">{config.reward_description || "a reward"}</strong>
                {config.reward_type === "percent_discount" && <> ({config.reward_value}% off)</>}
                {config.reward_type === "fixed_amount" && <> (₹{config.reward_value} off)</>}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Min Bill Value */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Minimum Bill Value</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Only bills above this amount will count as a qualifying visit.</p>
            <div className="flex items-center gap-2 max-w-[250px]">
              <span className="text-lg font-bold">₹</span>
              <Input
                type="number"
                value={config.min_bill_value}
                onChange={(e) => setConfig({ ...config, min_bill_value: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <p className="text-xs text-muted-foreground">Set to 0 for no minimum.</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Points rule explainer */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Points-based rewards
          </p>
          <p className="text-muted-foreground">
            <strong>Earning:</strong> ₹10 spent = 1 point. <strong>Redeeming:</strong> 1 point = ₹1 off
            (applied automatically when a known customer is selected at billing).
          </p>
        </CardContent>
      </Card>

      {/* Top Loyalty Customers */}
      {hotelId && <TopLoyaltyCustomers hotelId={hotelId} />}

      <Button onClick={saveConfig} disabled={saving} className="w-full h-12 text-base font-semibold">
        <Save className="h-5 w-5 mr-2" />
        {saving ? "Saving..." : "Save Loyalty Settings"}
      </Button>
    </div>
  );
};

export default LoyaltySettings;
