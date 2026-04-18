import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, CheckCheck, UserPlus, IndianRupee, AlertTriangle, Megaphone, Target, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  is_read: boolean;
  navigate_to: string;
  metadata: any;
  created_at: string;
}

const TYPE_META: Record<string, { icon: any; color: string; bg: string; label: string; cat: "alert" | "system" | "info" }> = {
  lead:      { icon: Target,         color: "#F97316", bg: "rgba(249,115,22,0.12)", label: "Demo Lead",   cat: "info" },
  signup:    { icon: UserPlus,       color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Signup",      cat: "info" },
  payment:   { icon: IndianRupee,    color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Payment",     cat: "info" },
  expiring:  { icon: AlertTriangle,  color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Expiring",    cat: "alert" },
  system:    { icon: Server,         color: "#EF4444", bg: "rgba(239,68,68,0.12)",  label: "System",      cat: "system" },
  broadcast: { icon: Megaphone,      color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", label: "Broadcast",   cat: "system" },
};

type FilterTab = "all" | "unread" | "alerts" | "system";

interface Props {
  onNavigate?: (target: string) => void;
}

export function AdminNotifications({ onNavigate }: Props) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Initial fetch
  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setNotifications(data as AdminNotification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin_notifications_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        const newNotif = payload.new as AdminNotification;
        setNotifications(prev => [newNotif, ...prev].slice(0, 100));
        // Toast popup
        const meta = TYPE_META[newNotif.type] || TYPE_META.system;
        toast(newNotif.title, {
          description: newNotif.description,
          duration: 4000,
          style: {
            background: "#131C35",
            border: "1px solid #1E2D4A",
            borderLeft: `3px solid ${meta.color}`,
            color: "#E5EAF5",
          },
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_notifications" }, (payload) => {
        const updated = payload.new as AdminNotification;
        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "admin_notifications" }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from("admin_notifications").update({ is_read: true }).in("id", unreadIds);
  };

  const handleClick = async (notif: AdminNotification) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      await supabase.from("admin_notifications").update({ is_read: true }).eq("id", notif.id);
    }
    setOpen(false);
    if (onNavigate && notif.navigate_to) onNavigate(notif.navigate_to);
  };

  const filtered = notifications.filter(n => {
    if (tab === "all") return true;
    if (tab === "unread") return !n.is_read;
    const cat = TYPE_META[n.type]?.cat;
    if (tab === "alerts") return cat === "alert";
    if (tab === "system") return cat === "system";
    return true;
  });

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl transition-all duration-200"
        style={{ backgroundColor: open ? "#131C35" : "transparent", border: "1px solid", borderColor: open ? "#1E2D4A" : "transparent" }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.backgroundColor = "rgba(30,45,74,0.5)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.backgroundColor = "transparent"; }}
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" style={{ color: "#E5EAF5" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ backgroundColor: "#EF4444", boxShadow: "0 0 8px rgba(239,68,68,0.6)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: "min(400px, calc(100vw - 24px))",
            backgroundColor: "#131C35",
            border: "1px solid #1E2D4A",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            animation: "slideDownFade 0.2s ease-out",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <style>{`
            @keyframes slideDownFade {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1E2D4A" }}>
            <div>
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <p className="text-[10px]" style={{ color: "#7A8AAB" }}>{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
                  style={{ color: "#F97316" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg transition-colors"
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(30,45,74,0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <X className="h-3.5 w-3.5" style={{ color: "#7A8AAB" }} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 py-2" style={{ borderBottom: "1px solid #1E2D4A" }}>
            {(["all", "unread", "alerts", "system"] as FilterTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all"
                style={{
                  backgroundColor: tab === t ? "rgba(249,115,22,0.15)" : "transparent",
                  color: tab === t ? "#F97316" : "#7A8AAB",
                  border: "1px solid",
                  borderColor: tab === t ? "rgba(249,115,22,0.35)" : "transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-xs" style={{ color: "#7A8AAB" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-semibold text-white">All caught up!</p>
                <p className="text-[11px] mt-1" style={{ color: "#7A8AAB" }}>No notifications here</p>
              </div>
            ) : (
              <div>
                {filtered.map(n => {
                  const meta = TYPE_META[n.type] || TYPE_META.system;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        backgroundColor: n.is_read ? "transparent" : "rgba(249,115,22,0.04)",
                        borderBottom: "1px solid rgba(30,45,74,0.5)",
                        borderLeft: n.is_read ? "2px solid transparent" : `2px solid ${meta.color}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(30,45,74,0.5)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.is_read ? "transparent" : "rgba(249,115,22,0.04)"; }}
                    >
                      <div
                        className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: meta.bg }}
                      >
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-semibold text-white truncate">{n.title}</p>
                          {!n.is_read && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#F97316" }} />}
                        </div>
                        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "#9BA8C4" }}>{n.description}</p>
                        <p className="text-[10px] mt-1" style={{ color: "#7A8AAB" }}>
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
