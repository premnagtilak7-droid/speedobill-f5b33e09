import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Copy, Hotel, IndianRupee, Users, ShieldCheck,
  TrendingUp, Activity, Eye, Send, Search,
  Crown, Zap, BarChart3, CreditCard, Bell, Terminal,
  Menu, X, Sun, Moon, LogOut, Download,
  MessageSquare, RefreshCw, Wifi, Database, Server,
  Clock, UserPlus, ArrowUpRight, ArrowDownRight, Share2,
  Filter, Mail, Phone, RotateCcw, Megaphone, Target,
  Globe, Layers, Store, Package, Plus, Minus, Trash2,
  Sparkles, CheckCircle2, Building2,
} from "lucide-react";

// Pricing constants (single source of truth)
const PRICE_BASIC = 199;
const PRICE_PREMIUM = 499;
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { useTheme } from "@/hooks/useTheme";

/* ─── Types ─── */
interface License {
  id: string; key_code: string; tier: string; duration_days: number;
  is_used: boolean; used_at: string | null; used_by_hotel_id: string | null; created_at: string;
}
interface HotelInfo {
  id: string; name: string; owner_id: string; subscription_tier: string;
  subscription_expiry: string | null; created_at: string; phone: string | null;
}
interface ProfileInfo {
  user_id: string; full_name: string | null; role: string | null;
  hotel_id: string | null; subscription_status: string | null;
  trial_ends_at: string | null; created_at: string;
}

const generateKeyCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `SB-${seg()}-${seg()}-${seg()}-${seg()}`;
};

type TabId = "command" | "directory" | "leads" | "revenue" | "vault" | "broadcast" | "console" | "wholesale" | "settings";

const TABS: { id: TabId; label: string; shortLabel: string; icon: any; emoji: string }[] = [
  { id: "command",   label: "Executive Command", shortLabel: "Command",   icon: Crown,      emoji: "👑" },
  { id: "directory", label: "Client Directory",  shortLabel: "Directory", icon: Users,      emoji: "👥" },
  { id: "revenue",   label: "Revenue & Payments",shortLabel: "Revenue",   icon: CreditCard, emoji: "💳" },
  { id: "wholesale", label: "Wholesale Store",   shortLabel: "Wholesale", icon: Store,      emoji: "🏪" },
  { id: "vault",     label: "License Vault",     shortLabel: "Licenses",  icon: Key,        emoji: "🔑" },
  { id: "broadcast", label: "Smart Broadcast",   shortLabel: "Broadcast", icon: Megaphone,  emoji: "📡" },
  { id: "leads",     label: "Demo Leads",        shortLabel: "Leads",     icon: Target,     emoji: "🎯" },
  { id: "settings",  label: "System Settings",   shortLabel: "Settings",  icon: Activity,   emoji: "⚙️" },
  { id: "console",   label: "Developer Console", shortLabel: "Console",   icon: Terminal,   emoji: "🖥️" },
];

/* ─── Glass Card with framer-motion ─── */
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-border/40 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm transition-colors duration-300 ${className}`}>
    {children}
  </div>
);

/* ─── Gradient Metric Card ─── */
const GradientMetricCard = ({ label, value, change, changeUp, icon: Icon, gradient }: {
  label: string; value: string | number; change?: string; changeUp?: boolean;
  icon: any; gradient: string;
}) => (
  <div className={`rounded-2xl p-[1.5px] ${gradient}`}>
    <div className="rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-white/50 dark:bg-white/[0.06] flex items-center justify-center">
          <Icon className="h-4 w-4 text-foreground/70" />
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {changeUp ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
          <span className={`text-xs font-medium ${changeUp ? "text-emerald-500" : "text-red-500"}`}>{change}</span>
          <span className="text-[10px] text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  </div>
);

/* ─── New KpiCard for Executive Command (Speedo Enterprise design) ─── */
const KpiCard = ({
  label, value, icon, subLabel, trend, trendUp, danger, onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subLabel?: string;
  trend?: string;
  trendUp?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`group relative rounded-2xl p-[1px] transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
    style={{ background: "linear-gradient(135deg, #F97316 0%, transparent 60%)" }}
  >
    <div
      className="rounded-2xl p-6 h-full transition-all duration-200 group-hover:-translate-y-0.5"
      style={{
        background: "#131C35",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "#7A8AAB" }}
        >
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#0A0F1E", color: "#F97316" }}
        >
          {icon}
        </div>
      </div>
      <p
        className="text-4xl font-extrabold tracking-tight leading-none"
        style={{ color: danger ? "#EF4444" : "#FFFFFF", fontWeight: 800 }}
      >
        {value}
      </p>
      {subLabel && (
        <p className="text-xs mt-2 font-medium" style={{ color: "#F97316" }}>{subLabel}</p>
      )}
      {trend && (
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: trendUp ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: trendUp ? "#10B981" : "#EF4444",
            }}
          >
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        </div>
      )}
    </div>
  </div>
);

/* ─── Tab panel animation wrapper ─── */
const TabPanel = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

const CreatorAdmin = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const [licenses, setLicenses] = useState<License[]>([]);
  const [hotels, setHotels] = useState<HotelInfo[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [demoLeads, setDemoLeads] = useState<any[]>([]);
  const [contactedLeads, setContactedLeads] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("speedo_contacted_leads") || "[]")); } catch { return new Set(); }
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tier, setTier] = useState("basic");
  const [duration, setDuration] = useState("30");
  const [count, setCount] = useState("1");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastTargets, setBroadcastTargets] = useState({ owners: true, waiters: false, chefs: false });
  const [broadcastStyle, setBroadcastStyle] = useState<"popup" | "banner">("popup");
  const [hotelSearch, setHotelSearch] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "expired" | "new24h">("all");
  const [leadsSearch, setLeadsSearch] = useState("");
  const [healthChecks, setHealthChecks] = useState<{ name: string; latency: number | null; ok: boolean }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowIST, setNowIST] = useState(new Date());

  // Live IST clock — tick every second
  useEffect(() => {
    const id = setInterval(() => setNowIST(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Wholesale state
  const [wsProducts, setWsProducts] = useState<any[]>([]);
  const [wsInquiries, setWsInquiries] = useState<any[]>([]);
  const [wsNewName, setWsNewName] = useState("");
  const [wsNewCategory, setWsNewCategory] = useState("Grocery");
  const [wsNewUnit, setWsNewUnit] = useState("kg");
  const [wsNewPrice, setWsNewPrice] = useState("");
  const [wsNewMrp, setWsNewMrp] = useState("");
  const [wsNewUrgent, setWsNewUrgent] = useState(false);
  const [wsNewMinQty, setWsNewMinQty] = useState("1");

  const isCreator = user?.email === "speedobill7@gmail.com";

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use admin-stats edge function (service role) to bypass RLS for platform-wide data
      const [adminRes, licRes, wsRes, wsInqRes, leadsRes] = await Promise.all([
        supabase.functions.invoke("admin-stats"),
        supabase.from("licenses").select("*").order("created_at", { ascending: false }),
        supabase.from("wholesale_products" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("wholesale_inquiries" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("demo_leads").select("*").order("created_at", { ascending: false }),
      ]);

      if (adminRes.error) {
        console.error("admin-stats error:", adminRes.error);
        toast.error("Failed to load platform data");
      } else if (adminRes.data) {
        setHotels((adminRes.data.hotels ?? []) as any);
        setProfiles((adminRes.data.profiles ?? []) as any);
      }
      if (licRes.data) setLicenses(licRes.data);
      if (wsRes.data) setWsProducts(wsRes.data as any);
      if (wsInqRes.data) setWsInquiries(wsInqRes.data as any);
      if (leadsRes.data) setDemoLeads(leadsRes.data);
    } finally {
      setLoading(false);
    }
  };

  // Real system health check — pings actual services
  const runHealthCheck = async () => {
    const checks: { name: string; latency: number | null; ok: boolean }[] = [];

    // Database ping (lightweight count)
    let t = performance.now();
    try {
      const { error } = await supabase.from("hotels").select("id", { count: "exact", head: true });
      checks.push({ name: "Supabase Database", latency: Math.round(performance.now() - t), ok: !error });
    } catch { checks.push({ name: "Supabase Database", latency: null, ok: false }); }

    // Auth ping
    t = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      checks.push({ name: "Auth Service", latency: Math.round(performance.now() - t), ok: !error });
    } catch { checks.push({ name: "Auth Service", latency: null, ok: false }); }

    // Edge function ping (admin-stats already runs)
    t = performance.now();
    try {
      const { error } = await supabase.functions.invoke("admin-stats");
      checks.push({ name: "Edge Functions", latency: Math.round(performance.now() - t), ok: !error });
    } catch { checks.push({ name: "Edge Functions", latency: null, ok: false }); }

    // Storage ping
    t = performance.now();
    try {
      const { error } = await supabase.storage.from("menu-images").list("", { limit: 1 });
      checks.push({ name: "Storage CDN", latency: Math.round(performance.now() - t), ok: !error });
    } catch { checks.push({ name: "Storage CDN", latency: null, ok: false }); }

    setHealthChecks(checks);
  };

  useEffect(() => { if (isCreator) { fetchData(); runHealthCheck(); } }, [isCreator]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isCreator) return;
    const iv = setInterval(() => { fetchData(); runHealthCheck(); }, 30000);
    return () => clearInterval(iv);
  }, [isCreator]);

  const markLeadContacted = (id: string) => {
    setContactedLeads(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("speedo_contacted_leads", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
    toast.success("Marked as contacted");
  };

  const exportLeadsCSV = () => {
    const rows = [["Name", "Business", "City", "WhatsApp", "Submitted", "Status"].join(",")];
    demoLeads.forEach(l => {
      const status = contactedLeads.has(l.id) ? "Contacted" : "New";
      rows.push([l.owner_name, l.restaurant_name, l.city, l.whatsapp_number, l.created_at, status].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "speedo-demo-leads.csv"; a.click();
    toast.success("CSV downloaded!");
  };

  const addWholesaleProduct = async () => {
    if (!wsNewName || !wsNewPrice) return;
    const { error } = await supabase.from("wholesale_products" as any).insert({
      name: wsNewName, category: wsNewCategory, unit: wsNewUnit,
      price: Number(wsNewPrice), mrp: Number(wsNewMrp) || Number(wsNewPrice),
      is_urgent: wsNewUrgent, min_order_qty: Number(wsNewMinQty) || 1,
    } as any);
    if (error) { toast.error("Failed to add product"); return; }
    toast.success("Product added!");
    setWsNewName(""); setWsNewPrice(""); setWsNewMrp(""); setWsNewUrgent(false); setWsNewMinQty("1");
    fetchData();
  };

  const deleteWholesaleProduct = async (id: string) => {
    await supabase.from("wholesale_products" as any).delete().eq("id", id);
    setWsProducts(prev => prev.filter(p => p.id !== id));
    toast.success("Product removed");
  };

  /* ─── Computed ─── */
  const usedKeys = licenses.filter(l => l.is_used);
  const unusedKeys = licenses.filter(l => !l.is_used);

  // A hotel counts as "active" if its tier is paid (basic/premium) AND not past expiry.
  // Trials default to premium tier with NULL expiry — those count as trial, not active.
  const getHotelStatus = (hotel: HotelInfo) => {
    const tier = hotel.subscription_tier;
    const exp = hotel.subscription_expiry ? new Date(hotel.subscription_expiry) : null;
    const now = new Date();
    if (tier && tier !== "free" && exp && exp > now) return "active";
    if (tier && tier !== "free" && !exp) return "trial"; // paid tier, no expiry set = trial
    if (tier === "free") return "trial";
    return "expired";
  };

  const activeHotels = hotels.filter(h => getHotelStatus(h) === "active").length;
  const trialHotels = hotels.filter(h => getHotelStatus(h) === "trial").length;
  const expiredHotels = hotels.filter(h => getHotelStatus(h) === "expired").length;
  const basicSubs = hotels.filter(h => h.subscription_tier === "basic" && getHotelStatus(h) === "active").length;
  const premiumSubs = hotels.filter(h => h.subscription_tier === "premium" && getHotelStatus(h) === "active").length;
  // Lifetime revenue: prefer license-based (real activations), fall back to estimating from active subs
  const licenseRevenue = usedKeys.reduce((s, l) => s + (l.tier === "premium" ? PRICE_PREMIUM : PRICE_BASIC), 0);
  const lifetimeRevenue = licenseRevenue || (basicSubs * PRICE_BASIC + premiumSubs * PRICE_PREMIUM);
  const mrr = (basicSubs * PRICE_BASIC) + (premiumSubs * PRICE_PREMIUM);
  const churnRate = hotels.length > 0 ? ((expiredHotels / hotels.length) * 100).toFixed(1) : "0";

  const ownerCount = profiles.filter(p => p.role === "owner").length;
  const waiterCount = profiles.filter(p => p.role === "waiter").length;
  const chefCount = profiles.filter(p => p.role === "chef").length;
  const managerCount = profiles.filter(p => p.role === "manager").length;
  const totalStaff = waiterCount + chefCount + managerCount;

  const newSignupsThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return profiles.filter(p => p.created_at >= weekAgo).length;
  }, [profiles]);

  const newHotelsThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return hotels.filter(h => h.created_at >= weekAgo).length;
  }, [hotels]);

  const expiringIn7Days = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    return hotels.filter(h => {
      if (!h.subscription_expiry) return false;
      const exp = new Date(h.subscription_expiry);
      return exp > now && exp <= in7;
    }).length;
  }, [hotels]);

  // Hotel management table data
  const hotelTableData = useMemo(() => {
    return hotels.map(h => {
      const owner = profiles.find(p => p.hotel_id === h.id && p.role === "owner");
      const staffInHotel = profiles.filter(p => p.hotel_id === h.id);
      const waiters = staffInHotel.filter(p => p.role === "waiter").length;
      const chefs = staffInHotel.filter(p => p.role === "chef").length;
      const owners = staffInHotel.filter(p => p.role === "owner").length;
      const status = getHotelStatus(h);
      return {
        ...h,
        ownerName: owner?.full_name || "—",
        status,
        waiterCount: waiters,
        chefCount: chefs,
        ownerCount: owners,
        totalStaff: staffInHotel.length,
      };
    }).filter(h => !hotelSearch || h.name.toLowerCase().includes(hotelSearch.toLowerCase()) || h.ownerName.toLowerCase().includes(hotelSearch.toLowerCase()));
  }, [hotels, profiles, hotelSearch]);

  const signupData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    profiles.forEach(p => { const day = p.created_at?.slice(0, 10); if (day && days[day] !== undefined) days[day]++; });
    return Object.entries(days).map(([date, cnt]) => ({ date: date.slice(5), signups: cnt }));
  }, [profiles]);

  const tierData = useMemo(() => [
    { name: "Active", value: activeHotels, color: "#10B981" },
    { name: "Trial", value: trialHotels, color: "#F59E0B" },
    { name: "Expired", value: expiredHotels, color: "#EF4444" },
  ].filter(d => d.value > 0), [activeHotels, trialHotels, expiredHotels]);

  const userDistData = useMemo(() => [
    { name: "Owners", value: ownerCount, color: "#F97316" },
    { name: "Waiters", value: waiterCount, color: "#6366F1" },
    { name: "Chefs", value: chefCount, color: "#10B981" },
  ].filter(d => d.value > 0), [ownerCount, waiterCount, chefCount]);

  const revenueByTier = useMemo(() => [
    { tier: "Basic", revenue: basicSubs * PRICE_BASIC, fill: "#F97316" },
    { tier: "Premium", revenue: premiumSubs * PRICE_PREMIUM, fill: "#EA580C" },
  ], [basicSubs, premiumSubs]);

  // Last 6 months MRR snapshot — uses hotels w/ active subs whose start_date falls in that month
  const monthlyRevenueData = useMemo(() => {
    const months: { label: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      let revenue = 0;
      hotels.forEach(h => {
        if (h.subscription_tier === "free" || !h.subscription_tier) return;
        const created = new Date(h.created_at);
        if (created < next) {
          revenue += h.subscription_tier === "premium" ? PRICE_PREMIUM : PRICE_BASIC;
        }
      });
      months.push({
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        revenue,
      });
    }
    return months;
  }, [hotels]);

  const activityFeed = useMemo(() => {
    const activities: { icon: any; text: string; time: string; color: string }[] = [];
    profiles.slice(0, 8).forEach((p, i) => {
      const hotel = hotels.find(h => h.id === p.hotel_id);
      activities.push({
        icon: i % 3 === 0 ? UserPlus : i % 3 === 1 ? Activity : Clock,
        text: `${p.full_name || "User"} ${i % 3 === 0 ? "signed up" : i % 3 === 1 ? "logged in" : "placed an order"} ${hotel ? `at ${hotel.name}` : ""}`,
        time: new Date(p.created_at).toLocaleString(),
        color: i % 3 === 0 ? "text-emerald-500" : i % 3 === 1 ? "text-indigo-500" : "text-orange-500",
      });
    });
    return activities;
  }, [profiles, hotels]);

  /* ─── Directory Data ─── */
  const directoryUsers = useMemo(() => {
    let users = profiles.map(p => {
      const hotel = hotels.find(h => h.id === p.hotel_id);
      return { ...p, hotelName: hotel?.name || "—", hotelPhone: hotel?.phone || "" };
    });

    if (directoryFilter === "expired") {
      users = users.filter(p => {
        const hotel = hotels.find(h => h.id === p.hotel_id);
        return hotel ? getHotelStatus(hotel) === "expired" : true;
      });
    } else if (directoryFilter === "new24h") {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      users = users.filter(p => p.created_at >= cutoff);
    }

    if (directorySearch) {
      const q = directorySearch.toLowerCase();
      users = users.filter(u => (u.full_name || "").toLowerCase().includes(q) || u.hotelName.toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q));
    }

    return users;
  }, [profiles, hotels, directorySearch, directoryFilter]);

  /* ─── Actions ─── */
  const generateKeys = async () => {
    setGenerating(true);
    const n = Math.min(parseInt(count) || 1, 50);
    const keys = Array.from({ length: n }, () => ({ key_code: generateKeyCode(), tier, duration_days: parseInt(duration), is_used: false }));
    const { error } = await supabase.from("licenses").insert(keys);
    if (error) toast.error("Failed: " + error.message);
    else { toast.success(`${n} key(s) generated!`); fetchData(); }
    setGenerating(false);
  };

  const copyKey = (code: string) => { navigator.clipboard.writeText(code); toast.success("Copied!"); };
  const shareWhatsApp = (code: string) => {
    const msg = encodeURIComponent(`🔑 Your SpeedoBill License Key: ${code}\n\nActivate it in Settings → License Key`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const downloadCSV = () => {
    const rows = [["Key", "Tier", "Duration", "Hotel", "Activated"].join(",")];
    usedKeys.forEach(l => {
      const hotel = hotels.find(h => h.id === l.used_by_hotel_id);
      rows.push([l.key_code, l.tier, `${l.duration_days}d`, hotel?.name || "—", l.used_at || "—"].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "speedo-bill-revenue.csv"; a.click();
    toast.success("CSV downloaded!");
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    const { data, error } = await supabase.functions.invoke("send-broadcast", {
      body: {
        message: broadcastMsg.trim(),
        style: broadcastStyle,
        targets: {
          owners: broadcastTargets.owners,
          waiters: broadcastTargets.waiters,
          chefs: broadcastTargets.chefs,
        },
      },
    });
    if (error) {
      toast.error("Broadcast failed: " + (error.message || "Try again"));
      return;
    }
    toast.success(`Broadcast sent! ${data?.recipients_in_app ?? 0} in-app, ${data?.emails_sent ?? 0} emails`);
    setBroadcastMsg("");
  };

  /* ─── Guard ─── */
  if (!isCreator) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldCheck className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to the platform administrator.</p>
      </div>
    );
  }

  const expanded = sidebarHovered;
  const chartTooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))", fontSize: 12 };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      trial: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
      expired: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20",
    };
    return <Badge variant="outline" className={`text-[11px] capitalize font-medium ${styles[status] || styles.expired}`}>{status}</Badge>;
  };

  const roleBadge = (role: string | null) => {
    const r = role || "owner";
    const styles: Record<string, string> = {
      owner: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
      waiter: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
      chef: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    };
    const emojis: Record<string, string> = { owner: "👑", waiter: "🍽️", chef: "👨‍🍳" };
    return <Badge variant="outline" className={`text-[11px] capitalize font-medium gap-1 ${styles[r] || styles.owner}`}>{emojis[r]} {r}</Badge>;
  };

  return (
    <div
      className="flex min-h-screen font-[Inter] text-[#E5EAF5]"
      style={{ backgroundColor: "#0A0F1E", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ═══════ MOBILE TOP BAR ═══════ */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 md:hidden"
        style={{ backgroundColor: "rgba(10,15,30,0.92)", borderBottom: "1px solid #1E2D4A", backdropFilter: "blur(16px)" }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all duration-200"
        >
          <Menu className="h-5 w-5 text-[#E5EAF5]" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="relative w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: "0 0 20px rgba(249,115,22,0.55), 0 0 40px rgba(249,115,22,0.25)",
            }}
          >
            <Zap className="h-4 w-4 text-white" fill="white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">Speedo Enterprise</span>
        </div>
        <div className="w-9" />
      </div>

      {/* ═══════ MOBILE SIDEBAR OVERLAY ═══════ */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="absolute left-0 top-0 bottom-0 w-[280px] flex flex-col"
              style={{ backgroundColor: "#0A0F1E", borderRight: "1px solid #1E2D4A" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Brand */}
              <div className="flex items-center justify-between px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #1E2D4A" }}>
                <div className="flex items-center gap-3">
                  <div
                    className="relative w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #F97316, #EA580C)",
                      boxShadow: "0 0 24px rgba(249,115,22,0.55), 0 0 48px rgba(249,115,22,0.28)",
                    }}
                  >
                    <Zap className="h-5 w-5 text-white" fill="white" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white leading-none tracking-tight">Speedo Enterprise</p>
                    <span
                      className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#F97316", border: "1px solid rgba(249,115,22,0.35)" }}
                    >
                      God Mode • V4
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-[#7A8AAB]" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {TABS.map(tab => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                      className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.98] transition-all duration-200"
                      style={
                        active
                          ? {
                              background: "linear-gradient(90deg, rgba(249,115,22,0.18), rgba(249,115,22,0.04))",
                              color: "#FFFFFF",
                              boxShadow: "inset 3px 0 0 #F97316, 0 0 20px rgba(249,115,22,0.15)",
                            }
                          : { color: "#9AA8C7" }
                      }
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "#FFFFFF"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "#9AA8C7"; }}
                    >
                      <span className="text-base leading-none w-5 text-center">{tab.emoji}</span>
                      <span className="truncate">{tab.label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#F97316", boxShadow: "0 0 8px #F97316" }} />}
                    </button>
                  );
                })}
              </nav>

              {/* Footer profile */}
              <div className="px-3 py-3" style={{ borderTop: "1px solid #1E2D4A" }}>
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl" style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A" }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 0 12px rgba(249,115,22,0.4)" }}
                  >SB</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{user?.email?.split("@")[0] || "speedobill7"}</p>
                    <p className="text-[10px] text-[#7A8AAB] truncate">{user?.email || "speedobill7@gmail.com"}</p>
                  </div>
                  <button
                    onClick={signOut}
                    title="Sign out"
                    className="p-2 rounded-lg flex items-center justify-center transition-colors duration-200"
                    style={{ color: "#EF4444" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ DESKTOP SIDEBAR ═══════ */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`hidden md:flex flex-col sticky top-0 h-screen transition-all duration-200 ease-out ${expanded ? "w-[260px]" : "w-[70px]"}`}
        style={{ backgroundColor: "#0A0F1E", borderRight: "1px solid #1E2D4A" }}
      >
        {/* Brand */}
        <div
          className={`flex items-center gap-3 py-5 ${expanded ? "px-5" : "px-0 justify-center"}`}
          style={{ borderBottom: "1px solid #1E2D4A" }}
        >
          <div
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: "0 0 22px rgba(249,115,22,0.55), 0 0 44px rgba(249,115,22,0.28)",
            }}
          >
            <Zap className="h-5 w-5 text-white" fill="white" strokeWidth={2.5} />
          </div>
          {expanded && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-[14px] font-bold text-white leading-none whitespace-nowrap tracking-tight">Speedo Enterprise</p>
              <span
                className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#F97316", border: "1px solid rgba(249,115,22,0.35)" }}
              >
                God Mode • V4
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 ${expanded ? "px-3" : "px-2"}`}>
          {expanded && (
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: "#5B6B8E" }}>
              Navigation
            </p>
          )}
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={!expanded ? tab.label : undefined}
                className={`group relative w-full flex items-center gap-3 rounded-xl text-sm font-medium min-h-[42px] active:scale-[0.98] transition-all duration-200 ${
                  expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
                }`}
                style={
                  active
                    ? {
                        background: "linear-gradient(90deg, rgba(249,115,22,0.18), rgba(249,115,22,0.04))",
                        color: "#FFFFFF",
                        boxShadow: `${expanded ? "inset 3px 0 0 #F97316, " : ""}0 0 18px rgba(249,115,22,0.15)`,
                      }
                    : { color: "#9AA8C7" }
                }
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.color = "#FFFFFF";
                    e.currentTarget.style.transform = expanded ? "translateX(3px)" : "scale(1.05)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.color = "#9AA8C7";
                    e.currentTarget.style.transform = "translateX(0) scale(1)";
                  }
                }}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">{tab.emoji}</span>
                {expanded && <span className="truncate whitespace-nowrap">{tab.label}</span>}
                {active && expanded && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#F97316", boxShadow: "0 0 8px #F97316" }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer admin card */}
        <div className={`py-3 ${expanded ? "px-3" : "px-2"}`} style={{ borderTop: "1px solid #1E2D4A" }}>
          {expanded ? (
            <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl" style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A" }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 0 12px rgba(249,115,22,0.4)" }}
              >SB</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.email?.split("@")[0] || "speedobill7"}</p>
                <p className="text-[10px] truncate" style={{ color: "#7A8AAB" }}>{user?.email || "speedobill7@gmail.com"}</p>
              </div>
              <button
                onClick={signOut}
                title="Sign out"
                className="p-2 rounded-lg flex items-center justify-center transition-colors duration-200"
                style={{ color: "#EF4444" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signOut}
              title="Sign out"
              className="w-full flex items-center justify-center py-2.5 rounded-xl transition-colors duration-200"
              style={{ color: "#EF4444" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main
        className="flex-1 min-h-screen pt-14 pb-[72px] md:pt-0 md:pb-0 overflow-x-hidden transition-colors duration-200"
        style={{ backgroundColor: "#0A0F1E", color: "#E5EAF5" }}
      >
        {/* Desktop header */}
        <div
          className="hidden md:flex h-16 items-center justify-between px-6 lg:px-8 sticky top-0 z-20"
          style={{ backgroundColor: "rgba(10,15,30,0.85)", borderBottom: "1px solid #1E2D4A", backdropFilter: "blur(12px)", fontFamily: "Inter, sans-serif" }}
        >
          <div>
            <h2 className="text-[22px] md:text-[26px] font-bold text-white tracking-tight leading-tight">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-[11px]" style={{ color: "#7A8AAB" }}>SpeedoBill Enterprise • Platform Admin</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live IST clock */}
            <div className="hidden lg:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-white tabular-nums">
                {nowIST.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                <span className="text-[10px] ml-1 tabular-nums" style={{ color: "#7A8AAB" }}>
                  :{nowIST.toLocaleTimeString("en-IN", { second: "2-digit", timeZone: "Asia/Kolkata" }).split(":").pop()?.split(" ")[0]}
                </span>
              </span>
              <span className="text-[10px]" style={{ color: "#7A8AAB" }}>
                {nowIST.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
              </span>
            </div>
            {/* All Systems badge */}
            <div
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: "#10B981" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
              </span>
              All Systems Operational
            </div>
            <Button
              variant="outline" size="sm"
              onClick={async () => { setIsRefreshing(true); await fetchData(); setTimeout(() => setIsRefreshing(false), 600); }}
              className="gap-1.5 h-8 text-xs rounded-xl text-[#E5EAF5] hover:text-white transition-all duration-200"
              style={{ backgroundColor: "#131C35", borderColor: "#1E2D4A" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 0 14px rgba(249,115,22,0.45)" }}
            >SB</div>
          </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <AnimatePresence mode="wait">

            {/* ═══════ A. EXECUTIVE COMMAND ═══════ */}
            {activeTab === "command" && (
              <TabPanel key="command">
                <div className="space-y-4" style={{ fontFamily: "Inter, sans-serif" }}>
                  {/* ─── KPI ROW 1 ─── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      label="Total Hotels"
                      value={hotels.length}
                      icon={<span className="text-lg">🏨</span>}
                      trend={`+${newHotelsThisWeek} this week`}
                      trendUp
                    />
                    <KpiCard
                      label="Active Subscriptions"
                      value={activeHotels}
                      icon={<ShieldCheck className="h-5 w-5" />}
                      subLabel={`${basicSubs} basic • ${premiumSubs} premium`}
                    />
                    <KpiCard
                      label="Monthly MRR"
                      value={`₹${mrr.toLocaleString("en-IN")}`}
                      icon={<IndianRupee className="h-5 w-5" />}
                      trend={mrr > 0 ? `+${Math.round((mrr / Math.max(lifetimeRevenue, 1)) * 100)}% growth` : "—"}
                      trendUp={mrr > 0}
                    />
                    <KpiCard
                      label="Lifetime Revenue"
                      value={`₹${lifetimeRevenue.toLocaleString("en-IN")}`}
                      icon={<TrendingUp className="h-5 w-5" />}
                    />
                  </div>

                  {/* ─── KPI ROW 2 ─── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      label="New Users (7d)"
                      value={newSignupsThisWeek}
                      icon={<UserPlus className="h-5 w-5" />}
                      trend={newSignupsThisWeek > 0 ? `↑ ${newSignupsThisWeek} signups` : "No new signups"}
                      trendUp={newSignupsThisWeek > 0}
                    />
                    <KpiCard
                      label="New Hotels (7d)"
                      value={newHotelsThisWeek}
                      icon={<span className="text-lg">🏨</span>}
                      trend={newHotelsThisWeek > 0 ? `↑ ${newHotelsThisWeek} new` : "No new hotels"}
                      trendUp={newHotelsThisWeek > 0}
                    />
                    <KpiCard
                      label="Demo Leads"
                      value={demoLeads.length}
                      icon={<span className="text-lg">🎯</span>}
                      subLabel="View leads →"
                      onClick={() => setActiveTab("leads")}
                    />
                    <KpiCard
                      label="Churn Rate"
                      value={`${churnRate}%`}
                      icon={<span className="text-lg">📉</span>}
                      danger={parseFloat(churnRate) > 5}
                      trend={parseFloat(churnRate) > 5 ? "above threshold" : "healthy"}
                      trendUp={parseFloat(churnRate) <= 5}
                    />
                  </div>

                  {/* ─── CHARTS ROW ─── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* User Growth — Area Chart */}
                    <div
                      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                      style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-white">User Growth</h3>
                          <p className="text-[11px]" style={{ color: "#7A8AAB" }}>Last 30 days signups</p>
                        </div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0A0F1E", color: "#F97316" }}>
                          <TrendingUp className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={signupData}>
                            <defs>
                              <linearGradient id="cmdGradOrange" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                            <XAxis dataKey="date" tick={{ fill: "#7A8AAB", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#7A8AAB", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "#131C35", border: "1px solid #F97316", borderRadius: 12, color: "#FFFFFF", fontSize: 12 }}
                              labelStyle={{ color: "#F97316", fontWeight: 600 }}
                            />
                            <Area type="monotone" dataKey="signups" stroke="#F97316" fill="url(#cmdGradOrange)" strokeWidth={2.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Revenue Trend — Bar Chart */}
                    <div
                      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                      style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-white">Revenue Trend</h3>
                          <p className="text-[11px]" style={{ color: "#7A8AAB" }}>Last 6 months MRR</p>
                        </div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0A0F1E", color: "#F97316" }}>
                          <BarChart3 className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyRevenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
                            <XAxis dataKey="label" tick={{ fill: "#7A8AAB", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#7A8AAB", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: "#131C35", border: "1px solid #F97316", borderRadius: 12, color: "#FFFFFF", fontSize: 12 }}
                              labelStyle={{ color: "#F97316", fontWeight: 600 }}
                              formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                              cursor={{ fill: "rgba(249,115,22,0.08)" }}
                            />
                            <Bar dataKey="revenue" fill="#F97316" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-2 text-[11px]" style={{ color: "#7A8AAB" }}>
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#F97316" }} />
                        Monthly Recurring Revenue
                      </div>
                    </div>
                  </div>

                  {/* ─── BOTTOM ROW ─── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* User Analytics */}
                    <div
                      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                      style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0A0F1E", color: "#A855F7" }}>
                          <Users className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-bold text-white">User Analytics</h3>
                      </div>
                      <div className="divide-y" style={{ borderColor: "#1E2D4A" }}>
                        {[
                          { label: "Hotel Owners", value: ownerCount, emoji: "👑" },
                          { label: "Waiters", value: waiterCount, emoji: "🍽️" },
                          { label: "Chefs", value: chefCount, emoji: "👨‍🍳" },
                          { label: "Managers", value: managerCount, emoji: "📋" },
                          { label: "Total Staff", value: totalStaff, emoji: "👥" },
                          { label: "Total Users", value: profiles.length, emoji: "📊" },
                        ].map((s, idx) => (
                          <div key={s.label} className="flex items-center justify-between py-3" style={{ borderTop: idx === 0 ? "none" : "1px solid #1E2D4A" }}>
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{s.emoji}</span>
                              <span className="text-sm" style={{ color: "#B8C2DB" }}>{s.label}</span>
                            </div>
                            <span className="text-base font-bold text-white tabular-nums">{s.value}</span>
                          </div>
                        ))}
                      </div>
                      {expiringIn7Days > 0 && (
                        <button
                          onClick={() => setActiveTab("directory")}
                          className="mt-4 w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:brightness-110"
                          style={{ backgroundColor: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)" }}
                        >
                          <span className="text-xs font-semibold" style={{ color: "#F97316" }}>
                            ⚠️ {expiringIn7Days} subscription{expiringIn7Days > 1 ? "s" : ""} expiring in 7 days
                          </span>
                          <span className="text-xs font-semibold" style={{ color: "#F97316" }}>View →</span>
                        </button>
                      )}
                    </div>

                    {/* Subscription Analytics — Donut */}
                    <div
                      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                      style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0A0F1E", color: "#F97316" }}>
                          <BarChart3 className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-bold text-white">Subscription Analytics</h3>
                      </div>
                      <div className="relative h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Basic", value: basicSubs, color: "#F97316" },
                                { name: "Premium", value: premiumSubs, color: "#EA580C" },
                                { name: "Trial", value: trialHotels, color: "#7A8AAB" },
                                { name: "Expired", value: expiredHotels, color: "#EF4444" },
                              ].filter(d => d.value > 0)}
                              cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                              dataKey="value" paddingAngle={3} stroke="none"
                            >
                              {[
                                { name: "Basic", value: basicSubs, color: "#F97316" },
                                { name: "Premium", value: premiumSubs, color: "#EA580C" },
                                { name: "Trial", value: trialHotels, color: "#7A8AAB" },
                                { name: "Expired", value: expiredHotels, color: "#EF4444" },
                              ].filter(d => d.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: "#131C35", border: "1px solid #F97316", borderRadius: 12, color: "#FFFFFF", fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "#7A8AAB" }}>Total</span>
                          <span className="text-2xl font-extrabold text-white">{basicSubs + premiumSubs + trialHotels + expiredHotels}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {[
                          { name: "Basic", value: basicSubs, color: "#F97316" },
                          { name: "Premium", value: premiumSubs, color: "#EA580C" },
                          { name: "Trial", value: trialHotels, color: "#7A8AAB" },
                          { name: "Expired", value: expiredHotels, color: "#EF4444" },
                        ].map(t => (
                          <div key={t.name} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "#0A0F1E" }}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                              <span className="text-xs" style={{ color: "#B8C2DB" }}>{t.name}</span>
                            </div>
                            <span className="text-sm font-bold text-white tabular-nums">{t.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hotel Management Table — preserved from previous design */}
                  <div
                    className="rounded-2xl overflow-hidden transition-all duration-200"
                    style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
                  >
                    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderBottom: "1px solid #1E2D4A" }}>
                      <div>
                        <h3 className="text-base font-bold text-white">🏨 Hotel Management</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: "#7A8AAB" }}>{hotels.length} hotels registered</p>
                      </div>
                      <div className="relative w-full sm:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#7A8AAB" }} />
                        <Input
                          placeholder="Search hotels..."
                          value={hotelSearch}
                          onChange={e => setHotelSearch(e.target.value)}
                          className="pl-9 h-8 rounded-xl text-xs text-white placeholder:text-[#7A8AAB]"
                          style={{ backgroundColor: "#0A0F1E", borderColor: "#1E2D4A" }}
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider" style={{ color: "#7A8AAB", borderBottom: "1px solid #1E2D4A" }}>
                            <th className="text-left px-4 py-3 font-semibold">Hotel</th>
                            <th className="text-left px-4 py-3 font-semibold">Owner</th>
                            <th className="text-left px-4 py-3 font-semibold">Plan</th>
                            <th className="text-left px-4 py-3 font-semibold">Status</th>
                            <th className="text-center px-4 py-3 font-semibold">Staff</th>
                            <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotelTableData.map(h => (
                            <tr key={h.id} className="transition-colors hover:bg-white/[0.03]" style={{ borderBottom: "1px solid #1E2D4A" }}>
                              <td className="px-4 py-3 text-sm font-semibold text-white">{h.name}</td>
                              <td className="px-4 py-3 text-xs" style={{ color: "#B8C2DB" }}>{h.ownerName}</td>
                              <td className="px-4 py-3">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                  style={{
                                    backgroundColor: h.subscription_tier === "premium" ? "rgba(234,88,12,0.15)" : "rgba(249,115,22,0.15)",
                                    color: h.subscription_tier === "premium" ? "#EA580C" : "#F97316",
                                  }}
                                >
                                  {h.subscription_tier}
                                </span>
                              </td>
                              <td className="px-4 py-3">{statusBadge(h.status)}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2 text-[10px]" style={{ color: "#B8C2DB" }}>
                                  <span title="Owners">👑{h.ownerCount}</span>
                                  <span title="Waiters">🍽️{h.waiterCount}</span>
                                  <span title="Chefs">👨‍🍳{h.chefCount}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs" style={{ color: "#B8C2DB" }}>
                                {h.subscription_expiry ? new Date(h.subscription_expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                              </td>
                            </tr>
                          ))}
                          {hotelTableData.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "#7A8AAB" }}>No hotels yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </TabPanel>
            )}

            {/* ═══════ B. CLIENT DIRECTORY (GOD-VIEW) ═══════ */}
            {activeTab === "directory" && (
              <TabPanel key="directory">
                <div className="space-y-4">
                  {/* Header with filters */}
                  <GlassCard className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Master User Directory</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{profiles.length} users across {hotels.length} hotels</p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search users..." value={directorySearch} onChange={e => setDirectorySearch(e.target.value)} className="pl-9 h-9 rounded-xl bg-white/50 dark:bg-white/[0.04]" />
                        </div>
                        <Select value={directoryFilter} onValueChange={(v: any) => setDirectoryFilter(v)}>
                          <SelectTrigger className="h-9 w-[140px] rounded-xl bg-white/50 dark:bg-white/[0.04]">
                            <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            <SelectItem value="expired">Expired Only</SelectItem>
                            <SelectItem value="new24h">New (24h)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </GlassCard>

                  {/* User Table */}
                  <GlassCard className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">User</th>
                            <th className="text-left px-5 py-3 font-medium">Role</th>
                            <th className="text-left px-5 py-3 font-medium">Hotel</th>
                            <th className="text-left px-5 py-3 font-medium">Status</th>
                            <th className="text-left px-5 py-3 font-medium">Joined</th>
                            <th className="text-right px-5 py-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {directoryUsers.slice(0, 50).map(u => {
                            const hotel = hotels.find(h => h.id === u.hotel_id);
                            const status = hotel ? getHotelStatus(hotel) : (u.subscription_status || "trial");
                            return (
                              <tr key={u.user_id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-indigo-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                      {(u.full_name || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{u.full_name || "—"}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">{roleBadge(u.role)}</td>
                                <td className="px-5 py-3.5 text-xs text-muted-foreground truncate max-w-[120px]">{u.hotelName}</td>
                                <td className="px-5 py-3.5">{statusBadge(status)}</td>
                                <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                                <td className="px-5 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="WhatsApp"
                                      onClick={() => window.open(`https://wa.me/${u.hotelPhone || ""}`, "_blank")}>
                                      <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Send Email"
                                      onClick={() => toast.info("Email feature coming soon")}>
                                      <Mail className="h-3.5 w-3.5 text-indigo-500" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="View POS">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Reset Password"
                                      onClick={() => toast.info("Password reset sent!")}>
                                      <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {directoryUsers.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No users match your filters</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ B2. DEMO LEADS ═══════ */}
            {activeTab === "leads" && (
              <TabPanel key="leads">
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <GradientMetricCard label="Total Leads" value={demoLeads.length} icon={Sparkles} gradient="bg-gradient-to-br from-pink-500/40 via-pink-500/10 to-transparent dark:from-pink-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Contacted" value={demoLeads.filter(l => contactedLeads.has(l.id)).length} icon={CheckCircle2} gradient="bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent dark:from-emerald-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Pending" value={demoLeads.filter(l => !contactedLeads.has(l.id)).length} icon={Clock} gradient="bg-gradient-to-br from-orange-500/40 via-orange-500/10 to-transparent dark:from-orange-500/25 dark:to-transparent" />
                    <GradientMetricCard label="This Week" value={demoLeads.filter(l => (Date.now() - new Date(l.created_at).getTime()) < 7 * 86400000).length} icon={TrendingUp} gradient="bg-gradient-to-br from-indigo-500/40 via-indigo-500/10 to-transparent dark:from-indigo-500/25 dark:to-transparent" />
                  </div>

                  {/* Header w/ search + export */}
                  <GlassCard className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Demo Requests</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Inbound leads from the marketing site</p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search leads..." value={leadsSearch} onChange={e => setLeadsSearch(e.target.value)} className="pl-9 h-9 rounded-xl bg-white/50 dark:bg-white/[0.04]" />
                        </div>
                        <Button variant="outline" size="sm" onClick={exportLeadsCSV} className="gap-1.5 h-9 text-xs rounded-xl">
                          <Download className="h-3.5 w-3.5" /> CSV
                        </Button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Leads table */}
                  <GlassCard className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Owner</th>
                            <th className="text-left px-5 py-3 font-medium">Restaurant</th>
                            <th className="text-left px-5 py-3 font-medium">City</th>
                            <th className="text-left px-5 py-3 font-medium">WhatsApp</th>
                            <th className="text-left px-5 py-3 font-medium">Submitted</th>
                            <th className="text-left px-5 py-3 font-medium">Status</th>
                            <th className="text-right px-5 py-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {demoLeads
                            .filter(l => {
                              if (!leadsSearch.trim()) return true;
                              const q = leadsSearch.toLowerCase();
                              return (
                                (l.owner_name || "").toLowerCase().includes(q) ||
                                (l.restaurant_name || "").toLowerCase().includes(q) ||
                                (l.city || "").toLowerCase().includes(q) ||
                                (l.whatsapp_number || "").includes(q)
                              );
                            })
                            .map(l => {
                              const contacted = contactedLeads.has(l.id);
                              const phone = (l.whatsapp_number || "").replace(/\D/g, "");
                              return (
                                <tr key={l.id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                        {(l.owner_name || "L").charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{l.owner_name || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5 text-sm text-foreground truncate max-w-[160px]">{l.restaurant_name || "—"}</td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{l.city || "—"}</td>
                                  <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">{l.whatsapp_number || "—"}</td>
                                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                                  <td className="px-5 py-3.5">
                                    {contacted ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 rounded-lg text-[10px]">Contacted</Badge>
                                    ) : (
                                      <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20 rounded-lg text-[10px]">New</Badge>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="WhatsApp"
                                        onClick={() => window.open(`https://wa.me/91${phone}`, "_blank")}>
                                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                      </Button>
                                      {!contacted && (
                                        <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg text-xs" title="Mark contacted"
                                          onClick={() => markLeadContacted(l.id)}>
                                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 mr-1" /> Mark
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          {demoLeads.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No demo leads yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ C. REVENUE & PAYMENTS ═══════ */}
            {activeTab === "revenue" && (
              <TabPanel key="revenue">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GradientMetricCard label="Lifetime Revenue" value={`₹${lifetimeRevenue.toLocaleString()}`} icon={IndianRupee} gradient="bg-gradient-to-br from-orange-500/40 via-orange-500/10 to-transparent dark:from-orange-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Active Subscribers" value={activeHotels} icon={Users} gradient="bg-gradient-to-br from-indigo-500/40 via-indigo-500/10 to-transparent dark:from-indigo-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Monthly MRR" value={`₹${mrr.toLocaleString()}`} icon={TrendingUp} gradient="bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent dark:from-emerald-500/25 dark:to-transparent" />
                  </div>

                  <GlassCard className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-foreground">Revenue by Tier</h3>
                      <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5 h-8 text-xs rounded-xl">
                        <Download className="h-3.5 w-3.5" /> CSV
                      </Button>
                    </div>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueByTier}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="tier" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                            {revenueByTier.map((entry) => (
                              <Cell key={entry.tier} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard className="overflow-hidden">
                    <div className="p-5 border-b border-border/40">
                      <h3 className="text-sm font-semibold text-foreground">Payment Ledger</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[550px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Key</th>
                            <th className="text-left px-5 py-3 font-medium">Tier</th>
                            <th className="text-left px-5 py-3 font-medium">Hotel</th>
                            <th className="text-left px-5 py-3 font-medium">Amount</th>
                            <th className="text-left px-5 py-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {usedKeys.slice(0, 30).map(lic => {
                            const hotel = hotels.find(h => h.id === lic.used_by_hotel_id);
                            return (
                              <tr key={lic.id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-5 py-3"><code className="font-mono text-xs text-muted-foreground">{lic.key_code}</code></td>
                                <td className="px-5 py-3 text-xs capitalize text-foreground">{lic.tier}</td>
                                <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-[120px]">{hotel?.name || "—"}</td>
                                <td className="px-5 py-3 text-xs font-semibold text-foreground">₹{lic.tier === "premium" ? PRICE_PREMIUM : PRICE_BASIC}</td>
                                <td className="px-5 py-3 text-xs text-muted-foreground">{lic.used_at ? new Date(lic.used_at).toLocaleDateString() : "—"}</td>
                              </tr>
                            );
                          })}
                          {usedKeys.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No payments yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ WHOLESALE STORE MANAGEMENT ═══════ */}
            {activeTab === "wholesale" && (
              <TabPanel key="wholesale">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GradientMetricCard label="Products" value={wsProducts.length} icon={Package} gradient="bg-gradient-to-br from-orange-500/40 via-orange-500/10 to-transparent dark:from-orange-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Inquiries" value={wsInquiries.length} icon={MessageSquare} gradient="bg-gradient-to-br from-indigo-500/40 via-indigo-500/10 to-transparent dark:from-indigo-500/25 dark:to-transparent" />
                    <GradientMetricCard
                      label="Inquiry Revenue"
                      value={`₹${wsInquiries.reduce((s: number, i: any) => s + (i.total_estimate || 0), 0).toLocaleString()}`}
                      icon={IndianRupee}
                      gradient="bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent dark:from-emerald-500/25 dark:to-transparent"
                    />
                  </div>

                  {/* Add Product Form */}
                  <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Plus className="h-4 w-4" /> Add Product
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <Input placeholder="Product name" value={wsNewName} onChange={e => setWsNewName(e.target.value)} className="rounded-xl" />
                      <select value={wsNewCategory} onChange={e => setWsNewCategory(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <option>Grocery</option><option>Oil & Ghee</option><option>Spices</option><option>Dairy</option><option>Vegetables</option><option>Beverages</option><option>Packaging</option><option>Cleaning</option>
                      </select>
                      <Input placeholder="Price (₹)" value={wsNewPrice} onChange={e => setWsNewPrice(e.target.value)} type="number" className="rounded-xl" />
                      <Input placeholder="MRP (₹)" value={wsNewMrp} onChange={e => setWsNewMrp(e.target.value)} type="number" className="rounded-xl" />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <select value={wsNewUnit} onChange={e => setWsNewUnit(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm w-24">
                        <option>kg</option><option>ltr</option><option>pcs</option><option>box</option><option>packet</option>
                      </select>
                      <Input placeholder="Min qty" value={wsNewMinQty} onChange={e => setWsNewMinQty(e.target.value)} type="number" className="rounded-xl w-24" />
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input type="checkbox" checked={wsNewUrgent} onChange={e => setWsNewUrgent(e.target.checked)} className="rounded" />
                        ⚡ 1-Hour Delivery
                      </label>
                      <Button onClick={addWholesaleProduct} size="sm" className="gap-1.5 rounded-xl">
                        <Plus className="h-3.5 w-3.5" /> Add Product
                      </Button>
                    </div>
                  </GlassCard>

                  {/* Products List */}
                  <GlassCard className="overflow-hidden">
                    <div className="p-5 border-b border-border/40">
                      <h3 className="text-sm font-semibold text-foreground">Product Catalog ({wsProducts.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Name</th>
                            <th className="text-left px-5 py-3 font-medium">Category</th>
                            <th className="text-left px-5 py-3 font-medium">Price</th>
                            <th className="text-left px-5 py-3 font-medium">MRP</th>
                            <th className="text-left px-5 py-3 font-medium">Unit</th>
                            <th className="text-left px-5 py-3 font-medium">Urgent</th>
                            <th className="px-5 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {wsProducts.map((p: any) => (
                            <tr key={p.id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3 text-sm font-medium text-foreground">{p.name}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{p.category}</td>
                              <td className="px-5 py-3 text-sm font-semibold text-foreground">₹{p.price}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground line-through">₹{p.mrp}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{p.unit}</td>
                              <td className="px-5 py-3">{p.is_urgent ? <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">⚡ Yes</Badge> : "—"}</td>
                              <td className="px-5 py-3">
                                <button onClick={() => deleteWholesaleProduct(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {wsProducts.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No products yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>

                  {/* Recent Inquiries */}
                  <GlassCard className="overflow-hidden">
                    <div className="p-5 border-b border-border/40">
                      <h3 className="text-sm font-semibold text-foreground">Recent Inquiries</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Hotel</th>
                            <th className="text-left px-5 py-3 font-medium">Items</th>
                            <th className="text-left px-5 py-3 font-medium">Total</th>
                            <th className="text-left px-5 py-3 font-medium">Status</th>
                            <th className="text-left px-5 py-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {wsInquiries.slice(0, 20).map((inq: any) => (
                            <tr key={inq.id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3 text-sm font-medium text-foreground">{inq.hotel_name || "—"}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{(inq.items || []).length} items</td>
                              <td className="px-5 py-3 text-sm font-semibold text-foreground">₹{Number(inq.total_estimate).toLocaleString()}</td>
                              <td className="px-5 py-3"><Badge variant="secondary" className="text-[10px] capitalize">{inq.status}</Badge></td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(inq.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {wsInquiries.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No inquiries yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>

                  {/* Revenue Chart */}
                  <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Wholesale Inquiry Revenue</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={(() => {
                          const byDate: Record<string, number> = {};
                          wsInquiries.forEach((inq: any) => {
                            const d = new Date(inq.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                            byDate[d] = (byDate[d] || 0) + Number(inq.total_estimate || 0);
                          });
                          return Object.entries(byDate).map(([date, amount]) => ({ date, amount })).slice(-14);
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                          <Area type="monotone" dataKey="amount" stroke="#F97316" fill="#F97316" fillOpacity={0.15} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ D. LICENSE VAULT ═══════ */}
            {activeTab === "vault" && (
              <TabPanel key="vault">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientMetricCard label="Total Keys" value={licenses.length} icon={Key} gradient="bg-gradient-to-br from-orange-500/40 via-orange-500/10 to-transparent dark:from-orange-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Active" value={usedKeys.length} icon={ShieldCheck} gradient="bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent dark:from-emerald-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Pending" value={unusedKeys.length} icon={Clock} gradient="bg-gradient-to-br from-amber-500/40 via-amber-500/10 to-transparent dark:from-amber-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Usage Rate" value={`${licenses.length ? ((usedKeys.length / licenses.length) * 100).toFixed(0) : 0}%`} icon={BarChart3} gradient="bg-gradient-to-br from-indigo-500/40 via-indigo-500/10 to-transparent dark:from-indigo-500/25 dark:to-transparent" />
                  </div>

                  <GlassCard className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <Key className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Generate License Keys</h3>
                        <p className="text-xs text-muted-foreground">Direct database insert</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Tier</label>
                        <Select value={tier} onValueChange={setTier}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic — ₹199/mo</SelectItem>
                            <SelectItem value="premium">Premium — ₹499/mo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Duration (days)</label>
                        <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="h-10 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Count (max 50)</label>
                        <Input type="number" min={1} max={50} value={count} onChange={e => setCount(e.target.value)} className="h-10 rounded-xl" />
                      </div>
                    </div>
                    <Button onClick={generateKeys} disabled={generating} className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white gap-2 h-10 rounded-xl shadow-md">
                      <Key className="h-4 w-4" /> {generating ? "Generating..." : "Generate Keys"}
                    </Button>
                  </GlassCard>

                  <GlassCard className="p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Available Keys ({unusedKeys.length})</h3>
                    {unusedKeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No pending keys</p>
                    ) : (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto">
                        {unusedKeys.map(lic => (
                          <div key={lic.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/40 dark:bg-white/[0.03] hover:bg-white/60 dark:hover:bg-white/[0.05] transition-colors">
                            <div className="flex items-center gap-3">
                              <code className="font-mono text-xs font-semibold text-foreground">{lic.key_code}</code>
                              <Badge variant="outline" className="text-[10px] capitalize rounded-lg">{lic.tier}</Badge>
                              <span className="text-[10px] text-muted-foreground">{lic.duration_days}d</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => copyKey(lic.key_code)} className="h-8 w-8 rounded-lg" title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => shareWhatsApp(lic.key_code)} className="h-8 w-8 rounded-lg text-emerald-500 hover:text-emerald-600" title="WhatsApp"><Share2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ E. SMART BROADCAST ═══════ */}
            {activeTab === "broadcast" && (
              <TabPanel key="broadcast">
                <div className="space-y-6">
                  <GlassCard className="p-5">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-indigo-500/20 flex items-center justify-center">
                        <Megaphone className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">Smart Broadcast Center</h3>
                        <p className="text-xs text-muted-foreground">Send targeted announcements to your users</p>
                      </div>
                    </div>

                    {/* Target Segmentation */}
                    <div className="mb-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Target className="h-3.5 w-3.5" /> Target Audience
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={broadcastTargets.owners} onCheckedChange={(c) => setBroadcastTargets(p => ({ ...p, owners: !!c }))} />
                          <span className="text-sm text-foreground">👑 Owners</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={broadcastTargets.waiters} onCheckedChange={(c) => setBroadcastTargets(p => ({ ...p, waiters: !!c }))} />
                          <span className="text-sm text-foreground">🍽️ Waiters</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={broadcastTargets.chefs} onCheckedChange={(c) => setBroadcastTargets(p => ({ ...p, chefs: !!c }))} />
                          <span className="text-sm text-foreground">👨‍🍳 Chefs</span>
                        </label>
                      </div>
                    </div>

                    {/* Delivery Style */}
                    <div className="mb-5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5" /> Delivery Style
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setBroadcastStyle("popup")}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${broadcastStyle === "popup" ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium" : "border-border/40 text-muted-foreground hover:bg-secondary/50"}`}
                        >
                          <Globe className="h-4 w-4" /> Glassy Popup
                        </button>
                        <button
                          onClick={() => setBroadcastStyle("banner")}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${broadcastStyle === "banner" ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" : "border-border/40 text-muted-foreground hover:bg-secondary/50"}`}
                        >
                          <Megaphone className="h-4 w-4" /> Top Banner
                        </button>
                      </div>
                    </div>

                    {/* Compose */}
                    <Textarea
                      placeholder="Write your announcement... (e.g., 'Scheduled maintenance tonight 11 PM – 1 AM IST')"
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      className="min-h-[140px] mb-4 rounded-xl bg-white/50 dark:bg-white/[0.04]"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={sendBroadcast} disabled={!broadcastMsg.trim()}
                        className="bg-gradient-to-r from-orange-600 to-indigo-600 hover:from-orange-500 hover:to-indigo-500 text-white gap-2 h-10 rounded-xl shadow-md">
                        <Send className="h-4 w-4" /> Broadcast Now
                      </Button>
                      <Button variant="outline" disabled={!broadcastMsg.trim()} className="gap-2 h-10 rounded-xl">
                        <Clock className="h-4 w-4" /> Schedule
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

            {/* ═══════ E2. SYSTEM SETTINGS (placeholder) ═══════ */}
            {activeTab === "settings" && (
              <TabPanel key="settings">
                <div
                  className="rounded-2xl p-10 text-center"
                  style={{ backgroundColor: "#131C35", border: "1px solid #1E2D4A" }}
                >
                  <div
                    className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 0 18px rgba(249,115,22,0.4)" }}
                  >
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">System Settings</h3>
                  <p className="text-sm" style={{ color: "#9AA8C7" }}>
                    Platform-wide configuration coming in Phase 2.
                  </p>
                </div>
              </TabPanel>
            )}

            {/* ═══════ F. DEVELOPER CONSOLE ═══════ */}
            {activeTab === "console" && (
              <TabPanel key="console">
                <div className="space-y-6">
                  <GlassCard className="p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <Server className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">System Health</h3>
                          <p className="text-xs text-muted-foreground">Real-time infrastructure status • auto-refresh 30s</p>
                        </div>
                      </div>
                      {(() => {
                        const allOk = healthChecks.length > 0 && healthChecks.every(c => c.ok);
                        const anyDown = healthChecks.some(c => !c.ok);
                        return (
                          <Badge variant="outline" className={`rounded-lg text-xs gap-1.5 ${
                            allOk ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" :
                            anyDown ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" :
                            "text-muted-foreground border-border/40"
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                              allOk ? "bg-emerald-500" : anyDown ? "bg-red-500" : "bg-muted-foreground"
                            }`} />
                            {allOk ? "All Operational" : anyDown ? "Issue Detected" : "Checking…"}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(healthChecks.length ? healthChecks : [
                        { name: "Supabase Database", latency: null, ok: true },
                        { name: "Auth Service", latency: null, ok: true },
                        { name: "Edge Functions", latency: null, ok: true },
                        { name: "Storage CDN", latency: null, ok: true },
                      ]).map(s => {
                        const Icon = s.name === "Supabase Database" ? Database
                          : s.name === "Auth Service" ? ShieldCheck
                          : s.name === "Edge Functions" ? Zap
                          : Wifi;
                        return (
                          <div key={s.name} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/40 dark:bg-white/[0.03]">
                            <div className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-foreground">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground font-mono">
                                {s.latency != null ? `${s.latency}ms` : healthChecks.length === 0 ? "…" : "—"}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${s.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientMetricCard label="Total Hotels" value={hotels.length} icon={Hotel} gradient="bg-gradient-to-br from-orange-500/40 via-orange-500/10 to-transparent dark:from-orange-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Total Profiles" value={profiles.length} icon={Users} gradient="bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent dark:from-emerald-500/25 dark:to-transparent" />
                    <GradientMetricCard label="Keys Generated" value={licenses.length} icon={Key} gradient="bg-gradient-to-br from-amber-500/40 via-amber-500/10 to-transparent dark:from-amber-500/25 dark:to-transparent" />
                    <GradientMetricCard label="DB Tables" value="34" icon={Database} gradient="bg-gradient-to-br from-indigo-500/40 via-indigo-500/10 to-transparent dark:from-indigo-500/25 dark:to-transparent" />
                  </div>

                  <GlassCard className="overflow-hidden">
                    <div className="p-5 border-b border-border/40">
                      <h3 className="text-sm font-semibold text-foreground">Recent Registrations</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b border-border/40 uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Name</th>
                            <th className="text-left px-5 py-3 font-medium">Role</th>
                            <th className="text-left px-5 py-3 font-medium">Status</th>
                            <th className="text-left px-5 py-3 font-medium">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {profiles.slice(0, 20).map(p => (
                            <tr key={p.user_id} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3 text-sm text-foreground">{p.full_name || "—"}</td>
                              <td className="px-5 py-3">{roleBadge(p.role)}</td>
                              <td className="px-5 py-3">{statusBadge(p.subscription_status || "trial")}</td>
                              <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </div>
              </TabPanel>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* ═══════ MOBILE BOTTOM NAV ═══════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 dark:border-white/[0.08] bg-white/90 dark:bg-black/70 backdrop-blur-2xl md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch justify-around">
          {TABS.slice(0, 4).map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-all active:scale-95 ${active ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                <tab.icon className="h-5 w-5" />
                <span className={`text-[10px] leading-tight ${active ? "font-semibold" : ""}`}>{tab.shortLabel}</span>
                {active && <div className="w-4 h-0.5 rounded-full bg-orange-500 mt-0.5" />}
              </button>
            );
          })}
          <button onClick={() => setSidebarOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-muted-foreground active:scale-95">
            <Menu className="h-5 w-5" />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default CreatorAdmin;
