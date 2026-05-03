import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { onAppNotification, AppNotification } from "@/hooks/useRoleNotifications";
import { useAuth } from "@/hooks/useAuth";

interface BannerItem {
  id: string;
  title: string;
  body: string;
  type: "ready" | "order";
}

/**
 * Slides an orange banner down from the top when waiter receives:
 * - Order ready alert
 * - New table assigned
 * Auto-dismisses ready alerts after 5s.
 */
export function WaiterReadyBanner() {
  const { role } = useAuth();
  const [banners, setBanners] = useState<BannerItem[]>([]);

  useEffect(() => {
    if (role !== "waiter") return;
    const unsub = onAppNotification((n: AppNotification) => {
      if (n.type !== "ready" && n.type !== "order") return;
      const item: BannerItem = { id: `${n.id}-${Date.now()}`, title: n.title, body: n.body, type: n.type };
      setBanners((prev) => [item, ...prev].slice(0, 3));
      if (n.type === "ready") {
        setTimeout(() => setBanners((prev) => prev.filter((b) => b.id !== item.id)), 5000);
      }
    });
    return unsub;
  }, [role]);

  if (role !== "waiter" || banners.length === 0) return null;

  return (
    <div className="fixed top-[calc(56px+env(safe-area-inset-top))] md:top-12 left-0 right-0 z-[60] pointer-events-none px-3 flex flex-col items-center gap-2 pt-2">
      <AnimatePresence>
        {banners.map((b) => (
          <motion.div
            key={b.id}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl border-2 px-4 py-3 flex items-center gap-3 ${
              b.type === "ready"
                ? "bg-orange-500 border-orange-600 text-white"
                : "bg-blue-500 border-blue-600 text-white"
            }`}
          >
            <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{b.title}</p>
              <p className="text-xs opacity-95 truncate">{b.body}</p>
            </div>
            <button
              onClick={() => setBanners((prev) => prev.filter((x) => x.id !== b.id))}
              className="flex-shrink-0 p-1 rounded hover:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
