import { useState, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Crown, Zap, Star, Shield, Key, ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Zap,
    color: "#94A3B8",
    popular: false,
    features: [
      "Up to 5 tables",
      "Menu management (max 20 items)",
      "Basic order taking",
      "Basic billing",
      "1 staff member (owner only)",
      "Basic sales report",
      "KOT system",
      "Email support",
      "SpeedoBill branding on bills",
    ],
  },
  {
    name: "Basic",
    monthlyPrice: 199,
    yearlyPrice: 1990,
    icon: Zap,
    color: "#06B6D4",
    popular: true,
    features: [
      "Up to 20 tables",
      "Unlimited menu items",
      "Order & billing",
      "Daily sales reports",
      "KOT system",
      "Staff management (up to 5 users)",
      "AI menu scanner",
      "Basic analytics",
      "Data export",
      "Remove SpeedoBill branding",
      "Email support",
    ],
  },
  {
    name: "Premium",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    icon: Crown,
    color: "#F97316",
    popular: false,
    features: [
      "Unlimited tables",
      "Everything in Basic",
      "Advanced analytics",
      "Inventory management",
      "Customer management",
      "WhatsApp billing",
      "Unlimited staff",
      "Priority support",
      "Custom branding",
      "API access",
    ],
  },
];

const PricingContent = () => {
  const { user, hotelId } = useAuth();
  const { status, plan: currentPlan } = useSubscription();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  const handleActivateLicense = async () => {
    if (!licenseKey.trim() || !hotelId) return;
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-license", {
        body: { key_code: licenseKey.trim(), hotel_id: hotelId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("License activated! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e: any) {
      toast.error(e.message || "Activation failed");
    }
    setActivating(false);
  };

  const yearlySavings = 199 * 12 - 1990; // ₹398 saved on Basic yearly

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Choose Your <span className="gradient-text-orange">Plan</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Unlock the full power of SpeedoBill. Start with a 7-day free trial.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium transition-colors ${!yearly ? "text-foreground" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <button
            onClick={() => setYearly(!yearly)}
            aria-label="Toggle yearly pricing"
            className={`relative w-14 h-7 rounded-full transition-colors ${yearly ? "bg-primary" : "bg-secondary"}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${yearly ? "translate-x-7" : "translate-x-0.5"}`} />
          </button>
          <span className={`text-sm font-medium transition-colors ${yearly ? "text-foreground" : "text-muted-foreground"}`}>
            Yearly
          </span>
          {yearly && (
            <Badge className="gradient-btn-primary border-0 text-xs animate-pop-in">
              RECOMMENDED
            </Badge>
          )}
        </div>
        {yearly && (
          <p className="text-xs text-emerald-500 font-semibold">
            🎉 Save ₹{yearlySavings} on Basic — that's 2 months free!
          </p>
        )}
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isFree = plan.name === "Free";
          const isCurrentPlan = isFree
            ? (status === "free" || status === "expired")
            : (currentPlan?.toLowerCase() === plan.name.toLowerCase() && (status === "active" || status === "trial"));
          const monthlyEquivalent = yearly && !isFree ? Math.round(price / 12) : null;

          return (
            <div
              key={plan.name}
              className={`glass-card relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                plan.popular ? "ring-2 ring-primary shadow-xl shadow-primary/20" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 h-1 gradient-bar-orange" />
              )}
              {plan.popular && (
                <div className="absolute -top-0 right-4">
                  <Badge className="gradient-btn-primary border-0 rounded-t-none rounded-b-lg text-[10px] px-3 py-1.5">
                    <Star className="h-3 w-3 mr-1" /> MOST POPULAR
                  </Badge>
                </div>
              )}
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${plan.color}20` }}
                  >
                    <plan.icon className="h-5 w-5" style={{ color: plan.color }} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {isFree ? "₹0" : `₹${price}`}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {isFree ? "/forever" : `/${yearly ? "year" : "month"}`}
                    </span>
                  </div>
                  {monthlyEquivalent !== null && (
                    <p className="text-xs text-muted-foreground">
                      That's just ₹{monthlyEquivalent}/month
                    </p>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: plan.color }} />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-12 text-base font-semibold ${plan.popular ? "gradient-btn-primary" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                  disabled={isCurrentPlan || isFree}
                  onClick={() => {
                    if (!user) {
                      navigate("/auth");
                      return;
                    }
                    if (!isFree) toast.info("Payment integration coming soon! Use a license key to activate.");
                  }}
                >
                  {isCurrentPlan
                    ? "Current Plan"
                    : isFree
                      ? user ? "Current Plan" : "Get Started Free"
                      : user ? `Get ${plan.name}` : `Start with ${plan.name}`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* License Key Section — only for logged-in users */}
      {user && (
        <div className="glass-card p-6 md:p-8 max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Have a License Key?</h3>
              <p className="text-xs text-muted-foreground">Enter your key to activate your subscription</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="SB-XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="h-12 bg-secondary/50 border-border font-mono"
            />
            <Button
              className="h-12 px-6 gradient-btn-primary"
              onClick={handleActivateLicense}
              disabled={activating || !licenseKey.trim()}
            >
              {activating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Activate"
              )}
            </Button>
          </div>
          {status && (
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Current status:{" "}
                <span
                  className={`font-semibold ${
                    status === "active"
                      ? "text-emerald-500"
                      : status === "trial"
                        ? "text-amber-500"
                        : "text-destructive"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* CTA for logged-out users */}
      {!user && (
        <div className="text-center space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Public pricing page wrapper. Logged-in users see this rendered inside
 * AppLayout (via App.tsx routing). Logged-out users get a minimal public
 * frame with a "Back to website" link.
 */
const PricingPage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Logged-in: AppLayout (parent route) wraps us via <Outlet />
  if (user) {
    return <PricingContent />;
  }

  // Public: minimal header + content
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
          <Link to="/auth" className="text-sm font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <PricingContent />
    </div>
  );
};

export default memo(PricingPage);
