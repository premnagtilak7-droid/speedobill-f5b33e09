import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay } from "date-fns";
import {
  Search, Filter, Download, Shield, Clock, User, FileText,
  ChevronLeft, ChevronRight, ShoppingBag, IndianRupee, Ban,
  Settings as SettingsIcon, UtensilsCrossed, Users as UsersIcon,
  KeyRound, Percent, Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const PAGE_SIZE = 25;

type ActionMeta = {
  category: "order" | "payment" | "void" | "settings" | "menu" | "staff" | "loyalty" | "table";
  icon: typeof ShoppingBag;
};

const ACTION_META: Record<string, ActionMeta> = {
  order_placed: { category: "order", icon: ShoppingBag },
  order_billed: { category: "payment", icon: IndianRupee },
  order_voided: { category: "void", icon: Ban },
  item_voided: { category: "void", icon: Ban },
  discount_applied: { category: "payment", icon: Percent },
  table_merged: { category: "table", icon: Layers },
  table_unmerged: { category: "table", icon: Layers },
  menu_updated: { category: "menu", icon: UtensilsCrossed },
  staff_added: { category: "staff", icon: UsersIcon },
  pin_changed: { category: "staff", icon: KeyRound },
  settings_changed: { category: "settings", icon: SettingsIcon },
  loyalty_updated: { category: "loyalty", icon: SettingsIcon },
};

const CATEGORY_STYLE: Record<ActionMeta["category"], { badge: string; icon: string; bar: string }> = {
  order:    { badge: "bg-primary/15 text-primary border-primary/30",                      icon: "text-primary",                bar: "bg-primary" },
  payment:  { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: "text-emerald-500", bar: "bg-emerald-500" },
  void:     { badge: "bg-destructive/15 text-destructive border-destructive/30",          icon: "text-destructive",            bar: "bg-destructive" },
  settings: { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", icon: "text-blue-500",              bar: "bg-blue-500" },
  menu:     { badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30", icon: "text-cyan-500",              bar: "bg-cyan-500" },
  staff:    { badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30", icon: "text-indigo-500",     bar: "bg-indigo-500" },
  loyalty:  { badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: "text-amber-500",         bar: "bg-amber-500" },
  table:    { badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30", icon: "text-purple-500",     bar: "bg-purple-500" },
};

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "Last 30 Days", value: "30days" },
  { label: "All Time", value: "all" },
];

const formatAction = (action: string) =>
  action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const getMeta = (action: string): ActionMeta =>
  ACTION_META[action] || { category: "settings", icon: FileText };

const initials = (name?: string | null) => {
  if (!name) return "S";
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "S";
};

const AuditLog = () => {
  const { hotelId } = useAuth();
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("7days");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);

  const dateFilter = useMemo(() => {
    const now = new Date();
    if (dateRange === "today") return startOfDay(now).toISOString();
    if (dateRange === "7days") return subDays(now, 7).toISOString();
    if (dateRange === "30days") return subDays(now, 30).toISOString();
    return null;
  }, [dateRange]);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", hotelId, dateRange, actionFilter, page],
    queryFn: async () => {
      if (!hotelId) return { logs: [], count: 0 };

      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFilter) query = query.gte("created_at", dateFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data: logs, error, count } = await query;
      if (error) throw error;
      return { logs: logs ?? [], count: count ?? 0 };
    },
    enabled: !!hotelId,
  });

  const logs = data?.logs ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.action?.toLowerCase().includes(s) ||
        l.performer_name?.toLowerCase().includes(s) ||
        l.details?.toLowerCase().includes(s),
    );
  }, [logs, search]);

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set).sort();
  }, [logs]);

  const handleExport = () => {
    if (!filteredLogs.length) {
      toast.error("No logs to export");
      return;
    }
    const header = "Date,Time,Action,Performed By,Table,Order ID,Details";
    const rows = filteredLogs.map((l) => {
      const d = new Date(l.created_at);
      return [
        format(d, "yyyy-MM-dd"),
        format(d, "HH:mm:ss"),
        l.action,
        l.performer_name || "-",
        l.table_number ?? "-",
        l.order_id ? l.order_id.slice(0, 8) : "-",
        `"${(l.details || "").replace(/"/g, '""')}"`,
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported");
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground">Track every action across your restaurant</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="gap-2 w-fit border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: totalCount, icon: FileText, tint: "from-primary/20 to-primary/5", iconColor: "text-primary" },
          { label: "Period", value: DATE_RANGES.find((d) => d.value === dateRange)?.label ?? "", icon: Clock, tint: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-500" },
          { label: "Unique Actions", value: uniqueActions.length, icon: Filter, tint: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500" },
          { label: "Staff Involved", value: new Set(logs.map((l) => l.performed_by)).size, icon: User, tint: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 overflow-hidden">
            <CardContent className={`p-4 bg-gradient-to-br ${s.tint}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold mt-0.5">{s.value}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-background/60 flex items-center justify-center">
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, staff, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 rounded-full bg-muted/50 border-border/60 focus-visible:bg-background"
          />
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        </div>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
          <SelectTrigger className="w-[160px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] rounded-full"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[160px]">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead className="text-center w-[80px]">Table</TableHead>
                <TableHead className="min-w-[200px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No audit events found</p>
                    <p className="text-xs mt-1">Actions like orders, voids, and settings changes will appear here</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log, idx) => {
                  const meta = getMeta(log.action);
                  const Icon = meta.icon;
                  const style = CATEGORY_STYLE[meta.category];
                  return (
                    <TableRow
                      key={log.id}
                      className={`group relative ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="font-medium text-foreground">{format(new Date(log.created_at), "dd MMM yyyy")}</div>
                        <div className="text-[11px] text-muted-foreground">{format(new Date(log.created_at), "hh:mm:ss a")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${style.badge}`}>
                            <Icon className={`h-3.5 w-3.5 ${style.icon}`} />
                          </span>
                          <Badge variant="outline" className={`text-xs font-medium ${style.badge}`}>
                            {formatAction(log.action)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-bold text-primary ring-1 ring-primary/20">
                            {initials(log.performer_name)}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[160px]">
                            {log.performer_name || "System"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">
                        {log.table_number ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[360px] truncate">
                        {log.details || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLog;
