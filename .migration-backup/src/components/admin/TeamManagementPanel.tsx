import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, RefreshCw, Mail, Shield, Trash2, Search, Users, CheckCircle2, Clock } from "lucide-react";

type InternalRole =
  | "super_admin"
  | "sales_manager"
  | "sales_executive"
  | "support_agent"
  | "tech_lead"
  | "finance_manager"
  | "marketing_manager";

interface TeamMember {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role: InternalRole;
  is_active: boolean;
  invited_at: string;
  joined_at: string | null;
  last_active_at: string | null;
}

const ROLE_LABELS: Record<InternalRole, string> = {
  super_admin: "Super Admin",
  sales_manager: "Sales Manager",
  sales_executive: "Sales Executive",
  support_agent: "Support Agent",
  tech_lead: "Tech Lead",
  finance_manager: "Finance Manager",
  marketing_manager: "Marketing Manager",
};

const ROLE_COLORS: Record<InternalRole, string> = {
  super_admin: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sales_manager: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sales_executive: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  support_agent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  tech_lead: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  finance_manager: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  marketing_manager: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const ROLE_PERMISSIONS: Record<InternalRole, string[]> = {
  super_admin: ["Full access to everything", "Manage team members", "All financial data"],
  sales_manager: ["View all hotels", "Assign leads", "Sales reports", "Revenue analytics"],
  sales_executive: ["View assigned leads", "Create demo accounts", "Log sales activity"],
  support_agent: ["View client issues", "Read-only hotel access", "Reset passwords", "Tickets"],
  tech_lead: ["View tickets", "System health", "Edge function logs"],
  finance_manager: ["Revenue reports", "Subscription analytics", "Payment data"],
  marketing_manager: ["Lead analytics", "Broadcast campaigns", "Conversion metrics"],
};

export default function TeamManagementPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<InternalRole>("support_agent");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("internal_team")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setMembers((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("internal_team_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_team" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m =>
      m.email.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q) ||
      ROLE_LABELS[m.role].toLowerCase().includes(q)
    );
  }, [members, search]);

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.is_active).length,
    pending: members.filter(m => !m.joined_at).length,
  }), [members]);

  const submitInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error("Email and name are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("internal_team").insert({
      email: inviteEmail.trim().toLowerCase(),
      full_name: inviteName.trim(),
      role: inviteRole,
      is_active: true,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invite sent to ${inviteEmail}. They join automatically when they sign up with this email.`);
    setShowInvite(false);
    setInviteEmail(""); setInviteName(""); setInviteRole("support_agent");
    load();
  };

  const updateRole = async (id: string, role: InternalRole) => {
    const { error } = await supabase.from("internal_team").update({ role }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Role updated");
  };

  const toggleActive = async (m: TeamMember) => {
    const { error } = await supabase.from("internal_team").update({ is_active: !m.is_active }).eq("id", m.id);
    if (error) toast.error(error.message); else toast.success(m.is_active ? "Member deactivated" : "Member activated");
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.full_name || m.email} from the team?`)) return;
    const { error } = await supabase.from("internal_team").delete().eq("id", m.id);
    if (error) toast.error(error.message); else toast.success("Member removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            SpeedoBill Team
          </h2>
          <p className="text-sm text-muted-foreground">Manage your internal company staff and their permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowInvite(true)} className="bg-orange-500 hover:bg-orange-600">
            <UserPlus className="w-4 h-4 mr-2" /> Invite Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</div>
          <div className="text-2xl font-bold text-emerald-500">{stats.active}</div>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</div>
          <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, or role" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Members */}
      <div className="space-y-2">
        {loading && <div className="text-center text-muted-foreground py-8">Loading team…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-muted-foreground">No team members yet. Invite someone to get started.</div>
          </div>
        )}
        {filtered.map(m => (
          <div key={m.id} className="p-4 rounded-xl border border-border/40 bg-card flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{m.full_name || m.email}</span>
                <Badge variant="outline" className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                {!m.is_active && <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">Inactive</Badge>}
                {!m.joined_at && <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pending signup</Badge>}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="w-3 h-3" /> {m.email}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {ROLE_PERMISSIONS[m.role].slice(0, 2).join(" • ")}
              </div>
            </div>
            <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as InternalRole)} disabled={m.role === "super_admin"}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as InternalRole[]).map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => toggleActive(m)} disabled={m.role === "super_admin"}>
              {m.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => removeMember(m)} disabled={m.role === "super_admin"}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>

      {/* Role legend */}
      <div className="p-4 rounded-xl border border-border/40 bg-card/50">
        <div className="text-sm font-semibold mb-3">Roles & Permissions</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {(Object.keys(ROLE_LABELS) as InternalRole[]).map(r => (
            <div key={r}>
              <Badge variant="outline" className={`${ROLE_COLORS[r]} mb-1`}>{ROLE_LABELS[r]}</Badge>
              <ul className="text-muted-foreground space-y-0.5 pl-1">
                {ROLE_PERMISSIONS[r].map(p => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <Input placeholder="Priya Sharma" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input placeholder="priya@speedobill.in" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <div className="text-[11px] text-muted-foreground mt-1">They get full access automatically once they sign up with this email.</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as InternalRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as InternalRole[]).filter(r => r !== "super_admin").map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={submitInvite} disabled={submitting} className="bg-orange-500 hover:bg-orange-600">
              {submitting ? "Inviting…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
