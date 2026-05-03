import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState } from "react";

const FREE_DAILY_LIMIT = 40;

/**
 * Returns whether the user can create an order (free plan: 40/day limit).
 * Call `checkLimit()` before creating an order.
 */
export function useDailyOrderLimit() {
  const { status } = useSubscription();
  const { hotelId } = useAuth();
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const hasAccess = status === "active" || status === "trial";

  const checkLimit = useCallback(async (): Promise<{ allowed: boolean; remaining: number }> => {
    // Paid users have unlimited orders
    if (hasAccess) return { allowed: true, remaining: Infinity };
    if (!hotelId) return { allowed: false, remaining: 0 };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .gte("created_at", todayStart.toISOString());

    const current = error ? 0 : (count ?? 0);
    setTodayCount(current);
    const remaining = Math.max(0, FREE_DAILY_LIMIT - current);
    return { allowed: current < FREE_DAILY_LIMIT, remaining };
  }, [hasAccess, hotelId]);

  return {
    checkLimit,
    todayCount,
    dailyLimit: hasAccess ? Infinity : FREE_DAILY_LIMIT,
    isFree: !hasAccess,
  };
}
