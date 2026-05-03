/**
 * Single source of truth for displaying a hotel's *current* plan in the admin panel.
 * Mirrors the logic used by the customer-facing useSubscription hook so admin & owner
 * always see the same value.
 *
 * Rules:
 *  - tier === 'free' OR no tier             → "free"
 *  - tier paid + no expiry set              → "trial"   (paid tier issued without a date)
 *  - tier paid + expiry in the future       → tier      ("basic" | "premium")
 *  - tier paid + expired ≤ 7 days           → "expired" (grace window — show as expired)
 *  - tier paid + expired > 7 days           → "free"    (downgraded automatically)
 */
export type DerivedPlan = "free" | "basic" | "premium" | "trial" | "expired";

export interface HotelPlanFields {
  subscription_tier?: string | null;
  subscription_expiry?: string | null;
}

const GRACE_DAYS = 7;

export function deriveHotelPlan(hotel: HotelPlanFields | null | undefined): DerivedPlan {
  if (!hotel) return "free";
  const tier = (hotel.subscription_tier || "free").toLowerCase();
  if (tier === "free" || !tier) return "free";

  const exp = hotel.subscription_expiry ? new Date(hotel.subscription_expiry) : null;
  if (!exp || isNaN(exp.getTime())) return "trial";

  const now = Date.now();
  const diffDays = Math.floor((exp.getTime() - now) / 86400000);

  if (diffDays >= 0) return tier as DerivedPlan; // active
  if (-diffDays <= GRACE_DAYS) return "expired";
  return "free";
}

export function planBadgeColor(plan: DerivedPlan): { bg: string; text: string } {
  switch (plan) {
    case "premium": return { bg: "#F97316", text: "white" };
    case "basic":   return { bg: "#1E2D4A", text: "white" };
    case "trial":   return { bg: "#6366F1", text: "white" };
    case "expired": return { bg: "#EF4444", text: "white" };
    default:        return { bg: "#374151", text: "white" };
  }
}
