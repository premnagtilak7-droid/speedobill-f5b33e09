import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Filter, Eye, Phone, Mail, RotateCcw, Download, Send,
  ShieldOff, X, Users as UsersIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import { UserProfileDrawer, type DirectoryHotel, type DirectoryUser } from "./UserProfileDrawer";
import { deriveHotelPlan, planBadgeColor } from "@/lib/adminPlan";
import { useEffect } from "react";
import { supabase as sb } from "@/integrations/supabase/client";

interface Props {
  profiles: any[];
  hotels: any[];
  onChanged: () => void;
  onSwitchToBroadcast?: (preselectUserIds: string[]) => void;
  /** Optional — when provided, opens the drawer for that hotel on mount. */
  focusHotelId?: string | null;
  onFocusHandled?: () => void;
}

const PANEL_BG = "#131C35";
const BORDER = "#1E2D4A";

export const ClientDirectory = ({ profiles, hotels, onChanged, focusHotelId, onFocusHandled }: Props) => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [joinedFilter, setJoinedFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<DirectoryUser | null>(null);
  const [working, setWorking] = useState(false);
  const [hotelMetrics, setHotelMetrics] = useState<Record<string, { staff: number; orders: number }>>({});

  // Fetch staff count + monthly orders per hotel (lightweight aggregate)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!hotels.length) return;
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [pRes, oRes] = await Promise.all([
        sb.from("profiles").select("hotel_id, role"),
        sb.from("orders").select("hotel_id").gte("created_at", monthStart.toISOString()),
      ]);
      if (cancelled) return;
      const m: Record<string, { staff: number; orders: number }> = {};
      (pRes.data || []).forEach((p: any) => {
        if (!p.hotel_id) return;
        m[p.hotel_id] ||= { staff: 0, orders: 0 };
        if (p.role && p.role !== "owner") m[p.hotel_id].staff += 1;
      });
      (oRes.data || []).forEach((o: any) => {
        if (!o.hotel_id) return;
        m[o.hotel_id] ||= { staff: 0, orders: 0 };
        m[o.hotel_id].orders += 1;
      });
      setHotelMetrics(m);
    };
    void run();
    const iv = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [hotels.length]);

  const enriched = useMemo<DirectoryUser[]>(() => {
    return profiles.map(p => {
      const hotel = hotels.find(h => h.id === p.hotel_id);
      return {
        ...p,
        hotelName: hotel?.name || "—",
        hotelPhone: hotel?.phone || "",
      };
    });
  }, [profiles, hotels]);

  // External focus → open drawer for the matching hotel's owner
  useEffect(() => {
    if (!focusHotelId) return;
    const owner = enriched.find(u => u.hotel_id === focusHotelId && u.role === "owner")
      || enriched.find(u => u.hotel_id === focusHotelId);
    if (owner) setDrawerUser(owner);
    onFocusHandled?.();
  }, [focusHotelId, enriched, onFocusHandled]);

  const counts = useMemo(() => {
    const total = enriched.length;
    const owners = enriched.filter(u => u.role === "owner").length;
    const waiters = enriched.filter(u => u.role === "waiter").length;
    const chefs = enriched.filter(u => u.role === "chef").length;
    const managers = enriched.filter(u => u.role === "manager").length;
    const active = enriched.filter(u => u.is_active !== false).length;
    const suspended = enriched.filter(u => u.is_active === false).length;
    let free = 0, basic = 0, premium = 0, expired = 0, trial = 0;
    enriched.forEach(u => {
      const h = hotels.find(x => x.id === u.hotel_id);
      const p = deriveHotelPlan(h);
      if (p === "premium") premium++;
      else if (p === "basic") basic++;
      else if (p === "trial") trial++;
      else if (p === "expired") expired++;
      else free++;
    });
    return { total, owners, waiters, chefs, managers, active, suspended, free, basic, premium, expired, trial };
  }, [enriched, hotels]);

  const filtered = useMemo(() => {
    let list = [...enriched];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.full_name || "").toLowerCase().includes(q)
        || (u.email || "").toLowerCase().includes(q)
        || u.hotelName.toLowerCase().includes(q));
    }
    if (roleFilter !== "all") list = list.filter(u => u.role === roleFilter);
    if (statusFilter === "active") list = list.filter(u => u.is_active !== false);
    if (statusFilter === "suspended") list = list.filter(u => u.is_active === false);
    if (planFilter !== "all") {
      list = list.filter(u => {
        const h = hotels.find(x => x.id === u.hotel_id);
        return deriveHotelPlan(h) === planFilter;
      });
    }
    if (joinedFilter !== "all") {
      const days = joinedFilter === "7d" ? 7 : joinedFilter === "30d" ? 30 : 90;
      const cutoff = Date.now() - days * 86400000;
      list = list.filter(u => new Date(u.created_at).getTime() >= cutoff);
    }
    if (cityFilter.trim()) {
      const q = cityFilter.toLowerCase();
      list = list.filter(u => {
        const h = hotels.find(x => x.id === u.hotel_id);
        return (h?.address || "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [enriched, hotels, search, roleFilter, statusFilter, planFilter, joinedFilter, cityFilter]);

  const visible = filtered.slice(0, 100);
  const allVisibleSelected = visible.length > 0 && visible.every(u => selected.has(u.user_id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach(u => next.delete(u.user_id));
    else visible.forEach(u => next.add(u.user_id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const exportCSV = (rows: DirectoryUser[]) => {
    const csv = [
      ["Name", "Email", "Role", "Hotel", "Plan", "Status", "Joined"].join(","),
      ...rows.map(u => {
        const h = hotels.find(x => x.id === u.hotel_id);
        return [
          (u.full_name || "").replace(/,/g, " "),
          u.email || "",
          u.role || "",
          (u.hotelName || "").replace(/,/g, " "),
          h?.subscription_tier || "free",
          u.is_active === false ? "suspended" : "active",
          new Date(u.created_at).toISOString(),
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `speedo-users-${Date.now()}.csv`; a.click();
    toast.success(`Exported ${rows.length} users`);
  };

  const bulkSuspend = async () => {
    if (!selected.size) return;
    if (!confirm(`Suspend ${selected.size} accounts? They will be locked out.`)) return;
    setWorking(true);
    try {
      const { error } = await supabase.functions.invoke("admin-user-action", {
        body: { action: "suspend", user_ids: Array.from(selected) },
      });
      if (error) throw error;
      toast.success(`Suspended ${selected.size} users`);
      setSelected(new Set());
      onChanged();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setWorking(false); }
  };

  const bulkChangePlan = async (plan: string) => {
    const hotelIds = new Set<string>();
    selected.forEach(uid => {
      const u = enriched.find(x => x.user_id === uid);
      if (u?.hotel_id) hotelIds.add(u.hotel_id);
    });
    if (!hotelIds.size) return toast.error("No hotels in selection");
    setWorking(true);
    try {
      for (const hid of hotelIds) {
        await supabase.functions.invoke("admin-user-action", {
          body: { action: "change_plan", hotel_id: hid, plan },
        });
      }
      toast.success(`Plan set to ${plan} for ${hotelIds.size} hotels`);
      setSelected(new Set());
      onChanged();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setWorking(false); }
  };

  const drawerHotel: DirectoryHotel | null = drawerUser?.hotel_id
    ? (hotels.find(h => h.id === drawerUser.hotel_id) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="rounded-2xl p-4" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Total" value={counts.total} active={roleFilter === "all" && statusFilter === "all" && planFilter === "all"} onClick={() => { setRoleFilter("all"); setStatusFilter("all"); setPlanFilter("all"); }} />
          <StatPill label="Owners" value={counts.owners} active={roleFilter === "owner"} onClick={() => setRoleFilter("owner")} />
          <StatPill label="Waiters" value={counts.waiters} active={roleFilter === "waiter"} onClick={() => setRoleFilter("waiter")} />
          <StatPill label="Chefs" value={counts.chefs} active={roleFilter === "chef"} onClick={() => setRoleFilter("chef")} />
          <StatPill label="Managers" value={counts.managers} active={roleFilter === "manager"} onClick={() => setRoleFilter("manager")} />
          <span className="mx-1 self-center text-slate-600">|</span>
          <StatPill label="Active" value={counts.active} tone="green" active={statusFilter === "active"} onClick={() => setStatusFilter("active")} />
          <StatPill label="Suspended" value={counts.suspended} tone="red" active={statusFilter === "suspended"} onClick={() => setStatusFilter("suspended")} />
          <span className="mx-1 self-center text-slate-600">|</span>
          <StatPill label="Free" value={counts.free} active={planFilter === "free"} onClick={() => setPlanFilter("free")} />
          <StatPill label="Basic" value={counts.basic} active={planFilter === "basic"} onClick={() => setPlanFilter("basic")} />
          <StatPill label="Premium" value={counts.premium} tone="orange" active={planFilter === "premium"} onClick={() => setPlanFilter("premium")} />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-2xl p-3 flex flex-wrap items-center gap-2" style={{ background: "#1F1408", border: "1px solid #F97316" }}>
          <span className="text-sm font-semibold text-white px-2">{selected.size} selected</span>
          <Button size="sm" onClick={() => exportCSV(enriched.filter(u => selected.has(u.user_id)))} style={{ background: "#1E2D4A", color: "white" }}>
            <Download className="h-4 w-4" />Export CSV
          </Button>
          <Select onValueChange={bulkChangePlan}>
            <SelectTrigger className="h-9 w-[170px]" style={{ background: "#1E2D4A", borderColor: BORDER, color: "white" }}>
              <SelectValue placeholder="Change plan…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={bulkSuspend} disabled={working} style={{ background: "#EF4444", color: "white" }}>
            <ShieldOff className="h-4 w-4" />Suspend
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-slate-300 hover:text-white ml-auto">
            <X className="h-4 w-4" />Clear
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Filters sidebar */}
        <div className="rounded-2xl" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}>
          <button
            onClick={() => setShowFilters(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white"
          >
            <span className="flex items-center gap-2"><Filter className="h-4 w-4" style={{ color: "#F97316" }} />Filters</span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showFilters && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: BORDER }}>
              <FilterField label="Role">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="chef">Chef</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Plan">
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="h-9" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Joined">
                <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                  <SelectTrigger className="h-9" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="City / address">
                <Input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="e.g. Pune" className="h-9" style={fieldStyle} />
              </FilterField>
              <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-white" onClick={() => {
                setRoleFilter("all"); setPlanFilter("all"); setStatusFilter("all"); setJoinedFilter("all"); setCityFilter(""); setSearch("");
              }}>Reset all</Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}>
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center justify-between" style={{ borderColor: BORDER }}>
            <div>
              <h3 className="text-base font-bold text-white">Master User Directory</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} of {enriched.length} users</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search name, email, hotel…" value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 w-[260px]" style={fieldStyle} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => exportCSV(filtered)} className="text-slate-300 hover:text-white">
                <Download className="h-4 w-4" />Export
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider" style={{ color: "#7A8AAB", borderBottom: `1px solid ${BORDER}` }}>
                  <th className="px-4 py-3 w-10"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} /></th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Hotel</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(u => {
                  const h = hotels.find(x => x.id === u.hotel_id);
                  const tier = (h?.subscription_tier || "free").toLowerCase();
                  const checked = selected.has(u.user_id);
                  return (
                    <tr key={u.user_id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td className="px-4 py-3"><Checkbox checked={checked} onCheckedChange={() => toggleOne(u.user_id)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)", color: "white" }}>
                            {(u.full_name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate max-w-[160px]">{u.full_name || "—"}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{u.email || "no email"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" style={{ borderColor: "#1E2D4A", color: "#F97316" }}>{(u.role || "—").toUpperCase()}</Badge></td>
                      <td className="px-4 py-3 text-slate-300 truncate max-w-[140px]">{u.hotelName}</td>
                      <td className="px-4 py-3">
                        <Badge style={{ background: tier === "premium" ? "#F97316" : tier === "basic" ? "#1E2D4A" : "#374151", color: "white" }}>
                          {tier.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active === false
                          ? <Badge style={{ background: "#EF4444", color: "white" }}>Suspended</Badge>
                          : <Badge style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>Active</Badge>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-300 hover:text-white" onClick={() => setDrawerUser(u)}>
                            <Eye className="h-3.5 w-3.5" />View
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="WhatsApp"
                            onClick={() => {
                              const p = (u.phone || h?.phone || "").replace(/\D/g, "");
                              if (!p) return toast.error("No phone");
                              window.open(`https://wa.me/${p}`, "_blank");
                            }}>
                            <Phone className="h-3.5 w-3.5" style={{ color: "#10B981" }} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Email"
                            onClick={() => u.email ? window.open(`mailto:${u.email}`) : toast.error("No email")}>
                            <Mail className="h-3.5 w-3.5 text-indigo-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-500">
                    <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No users match your filters
                  </td></tr>
                )}
              </tbody>
            </table>
            {filtered.length > visible.length && (
              <div className="px-4 py-3 text-xs text-slate-500 text-center" style={{ borderTop: `1px solid ${BORDER}` }}>
                Showing first {visible.length} of {filtered.length} — refine filters to narrow results.
              </div>
            )}
          </div>
        </div>
      </div>

      <UserProfileDrawer
        open={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        user={drawerUser}
        hotel={drawerHotel}
        onChanged={onChanged}
      />
    </div>
  );
};

const fieldStyle = { background: "#0A0F1E", borderColor: "#1E2D4A", color: "white" } as React.CSSProperties;

const FilterField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const StatPill = ({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "green" | "red" | "orange"; active?: boolean; onClick?: () => void }) => {
  const color = tone === "green" ? "#10B981" : tone === "red" ? "#EF4444" : tone === "orange" ? "#F97316" : "#FFFFFF";
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:brightness-125"
      style={{
        background: active ? "rgba(249,115,22,0.15)" : "#0A0F1E",
        border: `1px solid ${active ? "#F97316" : "#1E2D4A"}`,
        color: "white",
      }}
    >
      <span className="text-slate-400 mr-1.5">{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </button>
  );
};
