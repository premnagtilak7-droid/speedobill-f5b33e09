import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail, Phone, RotateCcw, ShieldOff, ShieldCheck, Calendar, IndianRupee,
  TrendingUp, Building2, Users as UsersIcon, Activity, Zap, Send, Loader2,
} from "lucide-react";

export interface DirectoryUser {
  user_id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  role: string | null;
  hotel_id: string | null;
  hotelName: string;
  hotelPhone: string;
  is_active?: boolean;
  created_at: string;
  subscription_status?: string | null;
}

export interface DirectoryHotel {
  id: string;
  name: string;
  phone: string | null;
  subscription_tier: string;
  subscription_expiry: string | null;
  subscription_start_date?: string | null;
  created_at: string;
  address?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: DirectoryUser | null;
  hotel: DirectoryHotel | null;
  onChanged: () => void;
}

const TIER_PRICE: Record<string, number> = { free: 0, basic: 199, premium: 499 };

export const UserProfileDrawer = ({ open, onClose, user, hotel, onChanged }: Props) => {
  const [activity, setActivity] = useState<{ type: string; text: string; at: string }[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [hotelStats, setHotelStats] = useState<{ orders: number; revenue: number; staff: number; waiters: number; chefs: number }>({
    orders: 0, revenue: 0, staff: 0, waiters: 0, chefs: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [working, setWorking] = useState(false);
  const [planSelect, setPlanSelect] = useState<string>(hotel?.subscription_tier || "free");
  const [waMessage, setWaMessage] = useState("");

  useEffect(() => {
    setPlanSelect(hotel?.subscription_tier || "free");
  }, [hotel?.id]);

  useEffect(() => {
    if (!open || !user) return;
    void loadActivity();
    void loadHotelStats();
  }, [open, user?.user_id, hotel?.id]);

  const loadActivity = async () => {
    if (!user) return;
    setLoadingActivity(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-action", {
        body: { action: "fetch_user_activity", user_id: user.user_id },
      });
      if (error) throw error;
      setActivity(data?.events ?? []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadHotelStats = async () => {
    if (!hotel) { setHotelStats({ orders: 0, revenue: 0, staff: 0, waiters: 0, chefs: 0 }); return; }
    setLoadingStats(true);
    try {
      const [ordersRes, staffRes] = await Promise.all([
        supabase.from("orders").select("total", { count: "exact" }).eq("hotel_id", hotel.id).not("billed_at", "is", null),
        supabase.from("profiles").select("role").eq("hotel_id", hotel.id),
      ]);
      const revenue = (ordersRes.data ?? []).reduce((s, o: any) => s + Number(o.total || 0), 0);
      const staff = staffRes.data ?? [];
      setHotelStats({
        orders: ordersRes.count ?? 0,
        revenue,
        staff: staff.length,
        waiters: staff.filter((p: any) => p.role === "waiter").length,
        chefs: staff.filter((p: any) => p.role === "chef").length,
      });
    } catch (e) { console.error(e); }
    finally { setLoadingStats(false); }
  };

  const callAction = async (body: any, successMsg: string) => {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-action", { body });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success(successMsg);
      onChanged();
      return data;
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally { setWorking(false); }
  };

  const onSuspendToggle = async () => {
    if (!user) return;
    const action = user.is_active === false ? "unsuspend" : "suspend";
    await callAction({ action, user_id: user.user_id }, action === "suspend" ? "Account suspended" : "Account reactivated");
  };

  const onExtend = async (days: number) => {
    if (!hotel) return;
    await callAction({ action: "extend_subscription", hotel_id: hotel.id, days }, `Extended by ${days} days`);
  };

  const onChangePlan = async () => {
    if (!hotel) return;
    await callAction({ action: "change_plan", hotel_id: hotel.id, plan: planSelect }, `Plan changed to ${planSelect}`);
  };

  const onResetPwd = async () => {
    if (!user?.email) return toast.error("No email on file");
    await callAction({ action: "reset_password", email: user.email }, "Reset link generated");
  };

  const sendWhatsApp = () => {
    const phone = (user?.phone || hotel?.phone || "").replace(/\D/g, "");
    if (!phone) return toast.error("No WhatsApp number");
    const msg = encodeURIComponent(waMessage || `Hi ${user?.full_name || ""}, this is SpeedoBill admin.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (!user) return null;

  const initials = (user.full_name || "U").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const tier = (hotel?.subscription_tier || "free").toLowerCase();
  const expiry = hotel?.subscription_expiry ? new Date(hotel.subscription_expiry) : null;
  const start = hotel?.subscription_start_date ? new Date(hotel.subscription_start_date) : new Date(hotel?.created_at || user.created_at);
  const daysRemaining = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : 0;
  const totalDays = expiry ? Math.max(1, Math.ceil((expiry.getTime() - start.getTime()) / 86400000)) : 30;
  const pct = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] p-0 border-l overflow-y-auto"
        style={{ background: "#0A0F1E", borderColor: "#1E2D4A", color: "white" }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{user.full_name || "User Profile"}</SheetTitle>
        </SheetHeader>

        {/* Section 1: Profile Header */}
        <div className="p-6" style={{ background: "linear-gradient(135deg,#131C35 0%,#0A0F1E 100%)", borderBottom: "1px solid #1E2D4A" }}>
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold shadow-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", color: "white" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">{user.full_name || "Unnamed user"}</h2>
                {user.is_active === false && <Badge style={{ background: "#EF4444", color: "white" }}>Suspended</Badge>}
              </div>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email || "no email"}</p>
              <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{user.phone || hotel?.phone || "—"}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="outline" style={{ borderColor: "#F97316", color: "#F97316" }}>
                  {(user.role || "owner").toUpperCase()}
                </Badge>
                <Badge style={{ background: tier === "premium" ? "#F97316" : tier === "basic" ? "#1E2D4A" : "#374151", color: "white" }}>
                  {tier.toUpperCase()}
                </Badge>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Active since {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-5">
            <Button size="sm" onClick={() => sendWhatsApp()} className="h-9" style={{ background: "#10B981", color: "white" }}>
              <Phone className="h-4 w-4" />WhatsApp
            </Button>
            <Button size="sm" onClick={() => user.email && window.open(`mailto:${user.email}`, "_blank")} className="h-9" style={{ background: "#1E2D4A", color: "white" }}>
              <Mail className="h-4 w-4" />Email
            </Button>
            <Button size="sm" onClick={onSuspendToggle} disabled={working} className="h-9" style={{ background: user.is_active === false ? "#10B981" : "#EF4444", color: "white" }}>
              {user.is_active === false ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
              {user.is_active === false ? "Reactivate" : "Suspend"}
            </Button>
            <Button size="sm" onClick={onResetPwd} disabled={working} className="h-9" style={{ background: "#1E2D4A", color: "white" }}>
              <RotateCcw className="h-4 w-4" />Reset Pwd
            </Button>
          </div>
        </div>

        {/* Section 2: Subscription Info */}
        <Section title="Subscription" icon={<Zap className="h-4 w-4" style={{ color: "#F97316" }} />}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Current plan" value={tier.toUpperCase()} />
            <Stat label="Monthly value" value={`₹${TIER_PRICE[tier] ?? 0}`} />
            <Stat label="Started" value={start ? start.toLocaleDateString() : "—"} />
            <Stat label="Expires" value={expiry ? expiry.toLocaleDateString() : "—"} />
          </div>
          {expiry && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>{daysRemaining} days remaining</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} className="h-2 bg-[#1E2D4A]" />
            </div>
          )}
        </Section>

        {/* Section 3: Hotel Info */}
        <Section title="Hotel" icon={<Building2 className="h-4 w-4" style={{ color: "#F97316" }} />}>
          {hotel ? (
            <>
              <div className="text-sm text-white font-semibold">{hotel.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{hotel.address || "No address on file"}</div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Stat label="Orders" value={loadingStats ? "…" : hotelStats.orders.toLocaleString()} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                <Stat label="Revenue" value={loadingStats ? "…" : `₹${hotelStats.revenue.toLocaleString("en-IN")}`} icon={<IndianRupee className="h-3.5 w-3.5" />} />
                <Stat label="Staff" value={loadingStats ? "…" : `${hotelStats.staff}`} sub={`${hotelStats.waiters}W • ${hotelStats.chefs}C`} icon={<UsersIcon className="h-3.5 w-3.5" />} />
              </div>
            </>
          ) : <p className="text-sm text-slate-500">No hotel linked</p>}
        </Section>

        {/* Section 4: Activity Log */}
        <Section title="Activity Log" icon={<Activity className="h-4 w-4" style={{ color: "#F97316" }} />}>
          {loadingActivity ? (
            <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500">No recorded activity</p>
          ) : (
            <ul className="space-y-2">
              {activity.slice(0, 10).map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm py-1.5 border-b" style={{ borderColor: "#1E2D4A" }}>
                  <span className="text-slate-200">{e.text}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Section 5: Admin Actions */}
        <Section title="Admin Actions" icon={<ShieldCheck className="h-4 w-4" style={{ color: "#F97316" }} />}>
          <div className="space-y-4">
            {/* Plan change */}
            {hotel && (
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider">Change Plan</label>
                <div className="flex gap-2 mt-1.5">
                  <Select value={planSelect} onValueChange={setPlanSelect}>
                    <SelectTrigger className="h-9 flex-1" style={{ background: "#131C35", borderColor: "#1E2D4A", color: "white" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic — ₹199</SelectItem>
                      <SelectItem value="premium">Premium — ₹499</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={onChangePlan} disabled={working || planSelect === tier} style={{ background: "#F97316", color: "white" }}>Save</Button>
                </div>
              </div>
            )}

            {/* Extend subscription */}
            {hotel && (
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider">Extend Subscription</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {[30, 60, 90].map(d => (
                    <Button key={d} variant="outline" disabled={working} onClick={() => onExtend(d)}
                      className="h-9" style={{ borderColor: "#F97316", color: "#F97316", background: "transparent" }}>
                      +{d} days
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom WhatsApp */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Send WhatsApp Message</label>
              <Textarea
                rows={3}
                placeholder="Type a custom message…"
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                className="mt-1.5"
                style={{ background: "#131C35", borderColor: "#1E2D4A", color: "white" }}
              />
              <Button onClick={sendWhatsApp} className="mt-2 w-full" style={{ background: "#10B981", color: "white" }}>
                <Send className="h-4 w-4" />Open WhatsApp
              </Button>
            </div>

            {/* Suspend toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#131C35", border: "1px solid #1E2D4A" }}>
              <div>
                <div className="text-sm text-white font-medium">Account active</div>
                <div className="text-xs text-slate-400">Suspending bans login + auth session</div>
              </div>
              <Switch checked={user.is_active !== false} onCheckedChange={onSuspendToggle} disabled={working} />
            </div>
          </div>
        </Section>
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="p-6 border-b" style={{ borderColor: "#1E2D4A" }}>
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h3>
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) => (
  <div className="rounded-lg p-3" style={{ background: "#131C35", border: "1px solid #1E2D4A" }}>
    <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">{icon}{label}</div>
    <div className="text-base font-bold text-white mt-1">{value}</div>
    {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
