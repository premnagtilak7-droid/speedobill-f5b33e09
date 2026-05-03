import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import {
  Crown, Gift, Target, Banknote, Sparkles, Save, Users, Award,
  Percent, IndianRupee, UtensilsCrossed, Repeat, BadgeCheck, HandCoins,
} from "lucide-react";
import { motion } from "framer-motion";
import TopLoyaltyCustomers from "@/components/loyalty/TopLoyaltyCustomers";

const VISIT_GOALS = [
  { n: 5, label: "Quick", icon: Sparkles, hint: "Frequent diners" },
  { n: 10, label: "Standard", icon: Target, hint: "Most popular" },
  { n: 15, label: "Loyal", icon: Award, hint: "Regulars" },
  { n: 20, label: "VIP", icon: Crown, hint: "True fans" },
] as const;

const REWARD_TYPES = [
  { value: "percent_discount", label: "% Discount", icon: Percent, hint: "e.g. 10% off bill" },
  { value: "fixed_amount", label: "Fixed Amount", icon: IndianRupee, hint: "e.g. ₹100 off" },
  { value: "free_item", label: "Free Item", icon: UtensilsCrossed, hint: "e.g. Free dessert" },
] as const;

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

      const { count: enrolled } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .or("loyalty_points.gt.0,visit_count.gt.0");
      setEnrolledCount(enrolled ?? 0);

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
        0,
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
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Loyalty Program</h1>
            <p className="text-sm text-muted-foreground">Reward repeat customers and grow visits</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`px-3 py-1.5 text-sm font-semibold rounded-full ${
            config.enabled
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
              : "bg-destructive/15 text-destructive border-destructive/40"
          }`}
        >
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${config.enabled ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
          {config.enabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Enrolled customers", value: enrolledCount, tint: "from-primary/20 to-primary/5", iconColor: "text-primary" },
          { icon: HandCoins, label: "Rewards this month", value: redeemedThisMonth, tint: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500" },
          { icon: Target, label: "Visits to reward", value: config.visit_goal, tint: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-500" },
        ].map((s, i) => (
          <Card key={i} className="border-border/50 overflow-hidden">
            <CardContent className={`p-4 bg-gradient-to-br ${s.tint}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-background/60 flex items-center justify-center">
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Master Switch */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">Enable Loyalty Program</p>
                  <p className="text-sm text-muted-foreground truncate">Customers earn rewards based on visit count</p>
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                className="scale-125 data-[state=checked]:bg-primary"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Goal — visual cards */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Visit Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">How many qualifying visits before a customer earns a reward?</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {VISIT_GOALS.map(({ n, label, icon: Icon, hint }) => {
                const active = config.visit_goal === n;
                return (
                  <button
                    key={n}
                    onClick={() => setConfig({ ...config, visit_goal: n })}
                    className={`group relative rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                        : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                    </div>
                    <p className={`mt-2 text-2xl font-bold ${active ? "text-primary" : "text-foreground"}`}>{n}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
                    {active && (
                      <BadgeCheck className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 max-w-[220px]">
              <Input
                type="number"
                value={config.visit_goal}
                onChange={(e) => setConfig({ ...config, visit_goal: parseInt(e.target.value) || 5 })}
                min={2}
                max={100}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">visits (custom)</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reward Type — card-based selection */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Reward Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {REWARD_TYPES.map(({ value, label, icon: Icon, hint }) => {
                const active = config.reward_type === value;
                return (
                  <button
                    key={value}
                    onClick={() => setConfig({ ...config, reward_type: value })}
                    className={`relative rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${active ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                    </div>
                    {active && <BadgeCheck className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {config.reward_type === "percent_discount" ? "Discount %" : config.reward_type === "fixed_amount" ? "Amount (₹)" : "Value (for reference)"}
                </label>
                <Input
                  type="number"
                  value={config.reward_value}
                  onChange={(e) => setConfig({ ...config, reward_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Reward Description</label>
                <Input
                  placeholder="e.g. Free Mutton Handi, ₹200 Off"
                  value={config.reward_description}
                  onChange={(e) => setConfig({ ...config, reward_description: e.target.value })}
                />
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
              <p className="text-xs uppercase tracking-wide text-primary/80 font-semibold mb-1">Customer sees</p>
              <p className="text-sm">
                After <strong>{config.visit_goal}</strong> visits → <strong className="text-primary">{config.reward_description || "a reward"}</strong>
                {config.reward_type === "percent_discount" && <> ({config.reward_value}% off)</>}
                {config.reward_type === "fixed_amount" && <> (₹{config.reward_value} off)</>}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Min Bill */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> Minimum Bill Value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Only bills above this amount count as a qualifying visit.</p>
            <div className="flex items-center gap-2 max-w-[260px]">
              <span className="text-lg font-bold text-muted-foreground">₹</span>
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

      {/* How it works */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: UtensilsCrossed, title: "1. Customer dines", text: "Their visit is logged automatically when a bill is settled with their phone." },
              { icon: Repeat, title: "2. Visits accumulate", text: `After ${config.visit_goal} qualifying visits, they unlock the reward.` },
              { icon: Gift, title: "3. Reward applied", text: "At billing, the reward is auto-suggested for the customer to redeem." },
            ].map((step, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-4 bg-card">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{step.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top customers */}
      {hotelId && <TopLoyaltyCustomers hotelId={hotelId} />}

      <Button onClick={saveConfig} disabled={saving} className="w-full h-12 text-base font-semibold">
        <Save className="h-5 w-5 mr-2" />
        {saving ? "Saving..." : "Save Loyalty Settings"}
      </Button>
    </div>
  );
};

export default LoyaltySettings;
