import { useMemo, useState } from "react";
import { AlertTriangle, AlertCircle, Info, X, ArrowRight, Clock } from "lucide-react";

interface HotelLite {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_expiry: string | null;
  created_at: string;
}
interface ProfileLite {
  user_id: string;
  full_name: string | null;
  created_at: string;
  subscription_status: string | null;
}
interface DemoLeadLite {
  id: string;
  owner_name: string;
  restaurant_name: string;
  city: string;
  whatsapp_number: string;
  created_at: string;
}

interface PendingKotsRow {
  hotel_id: string;
  hotel_name: string;
  count: number;
}
interface InactiveWaiterRow {
  user_id: string;
  full_name: string;
  hotel_name: string;
}
interface StuckBillRow {
  order_id: string;
  hotel_id: string;
  hotel_name: string;
  table_number: number | null;
  minutes_pending: number;
}

interface Props {
  hotels: HotelLite[];
  profiles: ProfileLite[];
  demoLeads: DemoLeadLite[];
  contactedLeadIds: string[];
  totalRevenue: number;
  /** Generic tab navigation */
  onNavigate: (tab: string) => void;
  /** Open the Client Directory drawer focused on a specific hotel */
  onViewHotel?: (hotelId: string) => void;
  onContactLead?: (lead: DemoLeadLite) => void;
  pendingKotsByHotel?: PendingKotsRow[];
  inactiveWaiters?: InactiveWaiterRow[];
  stuckBills?: StuckBillRow[];
}

type AlertItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string;
  onAction: () => void;
};

const SEV_STYLE = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.35)", label: "Critical", icon: AlertCircle },
  warning:  { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)", label: "Warning",  icon: AlertTriangle },
  info:     { color: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.35)", label: "Info",     icon: Info },
};

export function AdminAlertsPanel({
  hotels, profiles, demoLeads, contactedLeadIds, totalRevenue, onNavigate, onContactLead,
  pendingKotsByHotel = [], inactiveWaiters = [], stuckBills = [],
}: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const alerts = useMemo<AlertItem[]>(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const list: AlertItem[] = [];

    // CRITICAL — expired today
    const expiredToday = hotels.filter(h => {
      if (!h.subscription_expiry) return false;
      const exp = new Date(h.subscription_expiry).getTime();
      return exp < now && exp > now - day;
    });
    expiredToday.forEach(h => {
      list.push({
        id: `expired-${h.id}`,
        severity: "critical",
        title: `${h.name} subscription expired`,
        description: `Expired on ${new Date(h.subscription_expiry!).toLocaleDateString("en-IN")}. Reach out to renew.`,
        timestamp: h.subscription_expiry!,
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    });

    // CRITICAL — KOT pile-up (8+ pending) per hotel
    pendingKotsByHotel.filter(p => p.count >= 8).forEach(p => {
      list.push({
        id: `kot-pileup-${p.hotel_id}`,
        severity: "critical",
        title: `${p.hotel_name} has ${p.count} pending KOT orders`,
        description: `Kitchen is overloaded — orders may be delayed. Notify the team.`,
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    });

    // CRITICAL — bills pending 45+ minutes
    stuckBills.forEach(b => {
      list.push({
        id: `stuck-bill-${b.order_id}`,
        severity: "critical",
        title: `${b.hotel_name} — Table ${b.table_number ?? "?"} bill pending ${b.minutes_pending}m`,
        description: `Active order open for ${b.minutes_pending} minutes without billing. Check on the table.`,
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    });

    // WARNING — waiter not logged in today
    inactiveWaiters.forEach(w => {
      list.push({
        id: `waiter-inactive-${w.user_id}`,
        severity: "warning",
        title: `${w.full_name} (${w.hotel_name}) not logged in today`,
        description: `No clock-in recorded. Confirm shift coverage.`,
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    });

    // WARNING — expiring in 7 days
    const expiringSoon = hotels.filter(h => {
      if (!h.subscription_expiry) return false;
      const exp = new Date(h.subscription_expiry).getTime();
      return exp > now && exp - now < 7 * day;
    });
    expiringSoon.forEach(h => {
      const daysLeft = Math.ceil((new Date(h.subscription_expiry!).getTime() - now) / day);
      list.push({
        id: `expiring-${h.id}`,
        severity: "warning",
        title: `${h.name} expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
        description: `Subscription ends ${new Date(h.subscription_expiry!).toLocaleDateString("en-IN")}.`,
        timestamp: h.subscription_expiry!,
        actionLabel: "Renew",
        onAction: () => onNavigate("directory"),
      });
    });

    // WARNING — uncontacted leads >48h
    const staleLeads = demoLeads.filter(l => {
      if (contactedLeadIds.includes(l.id)) return false;
      return now - new Date(l.created_at).getTime() > 2 * day;
    });
    staleLeads.forEach(l => {
      list.push({
        id: `stale-lead-${l.id}`,
        severity: "warning",
        title: `Demo lead pending: ${l.owner_name}`,
        description: `${l.restaurant_name} • ${l.city} — waiting ${Math.floor((now - new Date(l.created_at).getTime()) / day)} days.`,
        timestamp: l.created_at,
        actionLabel: "Contact",
        onAction: () => { onContactLead?.(l); onNavigate("leads"); },
      });
    });

    // WARNING — inactive users (created > 30 days, no recent activity proxy)
    const inactiveCount = profiles.filter(p => now - new Date(p.created_at).getTime() > 30 * day).length;
    if (inactiveCount > 0) {
      list.push({
        id: "inactive-users",
        severity: "warning",
        title: `${inactiveCount} users inactive 30+ days`,
        description: "Users without recent app activity. Consider re-engagement.",
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    }

    // INFO — new signups today
    const signupsToday = hotels.filter(h => now - new Date(h.created_at).getTime() < day).length;
    if (signupsToday > 0) {
      list.push({
        id: "signups-today",
        severity: "info",
        title: `${signupsToday} new signup${signupsToday > 1 ? "s" : ""} today`,
        description: "Welcome the new hotel owners on the platform.",
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("directory"),
      });
    }

    // INFO — revenue milestones
    const milestones = [10000, 50000, 100000, 500000, 1000000];
    const hit = milestones.filter(m => totalRevenue >= m).pop();
    if (hit) {
      list.push({
        id: `revenue-${hit}`,
        severity: "info",
        title: `🎉 ₹${hit.toLocaleString("en-IN")} lifetime revenue milestone`,
        description: `Total platform revenue is now ₹${totalRevenue.toLocaleString("en-IN")}.`,
        timestamp: new Date().toISOString(),
        actionLabel: "View",
        onAction: () => onNavigate("revenue"),
      });
    }

    return list.filter(a => !dismissed.includes(a.id));
  }, [hotels, profiles, demoLeads, contactedLeadIds, totalRevenue, dismissed, onNavigate, onContactLead, pendingKotsByHotel, inactiveWaiters, stuckBills]);

  const grouped = {
    critical: alerts.filter(a => a.severity === "critical"),
    warning:  alerts.filter(a => a.severity === "warning"),
    info:     alerts.filter(a => a.severity === "info"),
  };

  const Card = ({ alert }: { alert: AlertItem }) => {
    const s = SEV_STYLE[alert.severity];
    const Icon = s.icon;
    return (
      <div
        className="rounded-xl p-4 transition-all duration-200"
        style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "rgba(10,15,30,0.5)" }}
          >
            <Icon className="h-4 w-4" style={{ color: s.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-[13px] font-semibold text-white leading-snug">{alert.title}</h4>
              <button
                onClick={() => setDismissed(d => [...d, alert.id])}
                className="flex-shrink-0 p-1 rounded hover:bg-white/5 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" style={{ color: "#7A8AAB" }} />
              </button>
            </div>
            <p className="text-[11px] mt-1" style={{ color: "#9BA8C4" }}>{alert.description}</p>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1 text-[10px]" style={{ color: "#7A8AAB" }}>
                <Clock className="h-3 w-3" />
                {new Date(alert.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <button
                onClick={alert.onAction}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                style={{ backgroundColor: s.color, color: "#fff" }}
              >
                {alert.actionLabel} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, items, severity }: { title: string; items: AlertItem[]; severity: keyof typeof SEV_STYLE }) => {
    const s = SEV_STYLE[severity];
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>
            {title} <span style={{ color: "#7A8AAB" }}>({items.length})</span>
          </h3>
        </div>
        {items.length === 0 ? (
          <div
            className="rounded-xl p-4 text-center text-[11px]"
            style={{ backgroundColor: "#131C35", border: "1px dashed #1E2D4A", color: "#7A8AAB" }}
          >
            No {severity} alerts
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(a => <Card key={a.id} alert={a} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.08), transparent)", border: "1px solid #1E2D4A" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">🚨 Alerts Center</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "#7A8AAB" }}>
              {alerts.length} active alert{alerts.length !== 1 ? "s" : ""} requiring attention
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1" style={{ color: "#EF4444" }}>● {grouped.critical.length} critical</span>
            <span className="flex items-center gap-1" style={{ color: "#F59E0B" }}>● {grouped.warning.length} warning</span>
            <span className="flex items-center gap-1" style={{ color: "#3B82F6" }}>● {grouped.info.length} info</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section title="Critical Alerts" items={grouped.critical} severity="critical" />
        <Section title="Warning Alerts" items={grouped.warning} severity="warning" />
        <Section title="Info Alerts" items={grouped.info} severity="info" />
      </div>
    </div>
  );
}
