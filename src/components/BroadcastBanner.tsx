import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Broadcast {
  id: string;
  message: string;
  style: string;
  target_owners: boolean;
  target_waiters: boolean;
  target_chefs: boolean;
  target_managers: boolean;
  created_at: string;
}

const BroadcastBanner = () => {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Broadcast[]>([]);

  useEffect(() => {
    if (!user || !role) return;
    let cancelled = false;

    const load = async () => {
      const { data: broadcasts } = await supabase
        .from("broadcasts")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (!broadcasts?.length || cancelled) return;

      const matchesRole = (b: Broadcast) =>
        (role === "owner" && b.target_owners) ||
        (role === "waiter" && b.target_waiters) ||
        (role === "chef" && b.target_chefs) ||
        (role === "manager" && b.target_managers);

      const candidates = broadcasts.filter(matchesRole);
      if (!candidates.length) return;

      const { data: reads } = await supabase
        .from("broadcast_reads")
        .select("broadcast_id")
        .eq("user_id", user.id)
        .in("broadcast_id", candidates.map((b) => b.id));

      const readIds = new Set((reads ?? []).map((r) => r.broadcast_id));
      const fresh = candidates.filter((b) => !readIds.has(b.id));
      if (!cancelled) setItems(fresh);
    };

    void load();
    return () => { cancelled = true; };
  }, [user, role]);

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((b) => b.id !== id));
    if (!user) return;
    await supabase.from("broadcast_reads").insert({ broadcast_id: id, user_id: user.id });
  };

  if (!items.length) return null;

  // Show popup-style as a centered glassy modal (only the first one),
  // banner-style stacked at top.
  const popupItem = items.find((b) => b.style === "popup");
  const bannerItems = items.filter((b) => b.style !== "popup").slice(0, 2);

  return (
    <>
      {popupItem && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={() => dismiss(popupItem.id)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-orange-300/40 dark:border-orange-500/30 bg-white/85 dark:bg-black/85 backdrop-blur-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => dismiss(popupItem.id)}
              className="absolute top-3 right-3 p-2 rounded-xl hover:bg-secondary/60"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  Announcement
                </p>
                <p className="text-sm font-bold text-foreground">SpeedoBill Team</p>
              </div>
            </div>
            <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed mb-5">
              {popupItem.message}
            </p>
            <Button
              onClick={() => dismiss(popupItem.id)}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {bannerItems.length > 0 && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] w-[min(94vw,640px)] space-y-2">
          {bannerItems.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-white/90 dark:bg-black/80 backdrop-blur-xl shadow-lg"
            >
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <Megaphone className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-0.5">
                  SpeedoBill Announcement
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{b.message}</p>
              </div>
              <button
                onClick={() => dismiss(b.id)}
                className="p-1.5 rounded-lg hover:bg-secondary/60 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default BroadcastBanner;
