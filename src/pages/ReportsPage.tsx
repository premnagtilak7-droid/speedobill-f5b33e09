import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  FileText, Download, Mail, Eye, FileSpreadsheet, Receipt,
  ClipboardList, Package, UserCheck, CalendarDays
} from "lucide-react";
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays
} from "date-fns";
import {
  generatePdfReport, downloadPdf, downloadCSV, calculateGST, fmtINR
} from "@/lib/report-utils";

type ReportKey = "daily-sales" | "weekly-summary" | "gst-monthly" | "inventory-usage" | "staff-attendance";

interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
  icon: typeof FileText;
  color: string;
  badge?: string;
}

const REPORTS: ReportDef[] = [
  { key: "daily-sales", title: "Daily Sales Report", description: "Today's revenue, orders, payments and top items.", icon: Receipt, color: "text-emerald-500" },
  { key: "weekly-summary", title: "Weekly Summary", description: "Last 7 days totals, day-by-day breakdown.", icon: ClipboardList, color: "text-cyan-500" },
  { key: "gst-monthly", title: "Monthly GST Report", description: "CGST + SGST breakdown — ready for your CA.", icon: FileSpreadsheet, color: "text-primary", badge: "CA Ready" },
  { key: "inventory-usage", title: "Inventory Usage Report", description: "Current stock, low items and recent purchases.", icon: Package, color: "text-amber-500" },
  { key: "staff-attendance", title: "Staff Attendance Report", description: "Clock-in / clock-out logs for the month.", icon: UserCheck, color: "text-purple-500" },
];

export default function ReportsPage() {
  const { hotelId, user } = useAuth();
  const [previewKey, setPreviewKey] = useState<ReportKey | null>(null);
  const [previewData, setPreviewData] = useState<{ summary: { label: string; value: string }[]; tables: { title?: string; head: string[]; body: (string | number)[][] }[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ─── Hotel info ───
  const { data: hotel } = useQuery({
    queryKey: ["report-hotel", hotelId],
    queryFn: async () => {
      if (!hotelId) return null;
      const { data } = await supabase
        .from("hotels")
        .select("name, tax_percent, gst_enabled, address, phone")
        .eq("id", hotelId)
        .maybeSingle();
      return data;
    },
    enabled: !!hotelId,
  });

  function getRange(key: ReportKey) {
    const now = new Date();
    switch (key) {
      case "daily-sales": return { from: startOfDay(now), to: endOfDay(now), label: format(now, "dd MMM yyyy") };
      case "weekly-summary": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), label: `${format(subDays(now, 6), "dd MMM")} – ${format(now, "dd MMM yyyy")}` };
      case "gst-monthly":
      case "inventory-usage":
      case "staff-attendance":
        return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") };
    }
  }

  async function buildReport(key: ReportKey) {
    if (!hotelId) throw new Error("Hotel not loaded");
    const { from, to, label } = getRange(key);
    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    if (key === "daily-sales" || key === "weekly-summary") {
      const { data: orders = [] } = await supabase
        .from("orders")
        .select("id, total, payment_method, created_at, status")
        .eq("hotel_id", hotelId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      const billed = (orders ?? []).filter((o) => o.status === "billed");
      const totalRev = billed.reduce((s, o) => s + Number(o.total), 0);
      const sumByMethod = (m: string) =>
        billed.filter((o) => (o.payment_method || "").toLowerCase() === m).reduce((s, o) => s + Number(o.total), 0);
      const cash = sumByMethod("cash");
      const upi = sumByMethod("upi");
      const card = sumByMethod("card");
      const razorpay = sumByMethod("razorpay");
      const other = totalRev - (cash + upi + card + razorpay);

      // Guest-initiated payment attempts (QR ordering)
      const { data: attempts = [] } = await supabase
        .from("payment_attempts")
        .select("method, amount, tip_amount, status")
        .eq("hotel_id", hotelId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      const verified = (attempts ?? []).filter((a: any) => a.status === "verified");
      const pendingCount = (attempts ?? []).filter((a: any) => a.status === "pending" || a.status === "verifying").length;
      const rejectedCount = (attempts ?? []).filter((a: any) => a.status === "rejected").length;
      const sumAtt = (m: string) => verified.filter((a: any) => a.method === m).reduce((s: number, a: any) => s + Number(a.amount) + Number(a.tip_amount || 0), 0);
      const guestUpi = sumAtt("upi");
      const guestCash = sumAtt("cash");
      const guestCard = sumAtt("card");
      const guestRzp = sumAtt("razorpay");
      const guestTotal = guestUpi + guestCash + guestCard + guestRzp;

      // top items
      const ids = billed.map((o) => o.id);
      const itemMap: Record<string, { qty: number; revenue: number }> = {};
      if (ids.length) {
        for (let i = 0; i < ids.length; i += 100) {
          const { data: items = [] } = await supabase
            .from("order_items")
            .select("name, price, quantity")
            .in("order_id", ids.slice(i, i + 100));
          (items ?? []).forEach((it) => {
            if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
            itemMap[it.name].qty += it.quantity;
            itemMap[it.name].revenue += Number(it.price) * it.quantity;
          });
        }
      }
      const topItems = Object.entries(itemMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const pct = (n: number) => totalRev ? `${Math.round((n / totalRev) * 100)}%` : "0%";

      return {
        title: key === "daily-sales" ? "Daily Sales Report" : "Weekly Summary",
        periodLabel: label,
        summary: [
          { label: "Revenue", value: fmtINR(totalRev) },
          { label: "Orders", value: String(billed.length) },
          { label: "Avg Bill", value: fmtINR(billed.length ? totalRev / billed.length : 0) },
          { label: "Top Item", value: topItems[0]?.name?.slice(0, 16) || "—" },
        ],
        tables: [
          { title: "Payment Breakdown (all bills)", head: ["Method", "Amount", "Share"],
            body: [
              ["💵 Cash", fmtINR(cash), pct(cash)],
              ["📱 UPI", fmtINR(upi), pct(upi)],
              ["💳 Card", fmtINR(card), pct(card)],
              ["🟦 Razorpay", fmtINR(razorpay), pct(razorpay)],
              ...(other > 0 ? [["Other / Counter", fmtINR(other), pct(other)]] : []),
              ["Total", fmtINR(totalRev), "100%"],
            ],
          },
          { title: `Guest QR Payments (${verified.length} verified · ${pendingCount} pending · ${rejectedCount} rejected)`,
            head: ["Method", "Verified Amount"],
            body: [
              ["UPI", fmtINR(guestUpi)],
              ["Cash", fmtINR(guestCash)],
              ["Card", fmtINR(guestCard)],
              ["Razorpay", fmtINR(guestRzp)],
              ["Total via QR", fmtINR(guestTotal)],
            ],
          },
          { title: "Top Selling Items", head: ["#", "Item", "Qty Sold", "Revenue"],
            body: topItems.map((t, i) => [String(i + 1), t.name, String(t.qty), fmtINR(t.revenue)]),
          },
        ],
      };
    }

    if (key === "gst-monthly") {
      const { data: orders = [] } = await supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("hotel_id", hotelId)
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      const billed = (orders ?? []).filter((o) => o.status === "billed");
      const gstRate = Number(hotel?.tax_percent ?? 5);
      const totals = billed.reduce(
        (acc, o) => {
          const g = calculateGST(Number(o.total), gstRate);
          acc.taxable += g.taxable;
          acc.cgst += g.cgst;
          acc.sgst += g.sgst;
          acc.gross += g.gross;
          return acc;
        },
        { taxable: 0, cgst: 0, sgst: 0, gross: 0 }
      );

      // item-wise GST
      const ids = billed.map((o) => o.id);
      const itemMap: Record<string, { qty: number; gross: number }> = {};
      if (ids.length) {
        for (let i = 0; i < ids.length; i += 100) {
          const { data: items = [] } = await supabase
            .from("order_items")
            .select("name, price, quantity")
            .in("order_id", ids.slice(i, i + 100));
          (items ?? []).forEach((it) => {
            if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, gross: 0 };
            itemMap[it.name].qty += it.quantity;
            itemMap[it.name].gross += Number(it.price) * it.quantity;
          });
        }
      }
      const itemRows = Object.entries(itemMap)
        .sort((a, b) => b[1].gross - a[1].gross)
        .slice(0, 30)
        .map(([name, v]) => {
          const g = calculateGST(v.gross, gstRate);
          return [name, String(v.qty), fmtINR(g.taxable), fmtINR(g.cgst), fmtINR(g.sgst), fmtINR(g.gross)];
        });

      return {
        title: "Monthly GST Report",
        periodLabel: label,
        summary: [
          { label: "Total Bills", value: String(billed.length) },
          { label: "Taxable Value", value: fmtINR(totals.taxable) },
          { label: "CGST + SGST", value: fmtINR(totals.cgst + totals.sgst) },
          { label: "Gross", value: fmtINR(totals.gross) },
        ],
        tables: [
          { title: `Tax Summary (GST ${gstRate}%)`, head: ["Component", "Rate", "Amount"],
            body: [
              ["CGST", `${gstRate / 2}%`, fmtINR(totals.cgst)],
              ["SGST", `${gstRate / 2}%`, fmtINR(totals.sgst)],
              ["IGST", "0%", fmtINR(0)],
              ["Total Tax", `${gstRate}%`, fmtINR(totals.cgst + totals.sgst)],
            ],
          },
          { title: "Item-wise GST Breakdown", head: ["Item", "Qty", "Taxable", "CGST", "SGST", "Gross"],
            body: itemRows.length ? itemRows : [["No billed orders in period", "", "", "", "", ""]],
          },
        ],
      };
    }

    if (key === "inventory-usage") {
      const { data: ingredients = [] } = await supabase
        .from("ingredients")
        .select("name, unit, current_stock, min_threshold")
        .eq("hotel_id", hotelId);
      const { data: purchases = [] } = await supabase
        .from("purchase_logs")
        .select("ingredient_id, quantity, unit_price, total_cost, purchased_at")
        .eq("hotel_id", hotelId)
        .gte("purchased_at", fromISO)
        .lte("purchased_at", toISO);

      const totalSpend = (purchases ?? []).reduce((s, p) => s + Number(p.total_cost), 0);
      const lowStock = (ingredients ?? []).filter((i) => Number(i.current_stock) <= Number(i.min_threshold));

      return {
        title: "Inventory Usage Report",
        periodLabel: label,
        summary: [
          { label: "Items Tracked", value: String((ingredients ?? []).length) },
          { label: "Low Stock", value: String(lowStock.length) },
          { label: "Purchases", value: String((purchases ?? []).length) },
          { label: "Spend", value: fmtINR(totalSpend) },
        ],
        tables: [
          { title: "Current Stock", head: ["Ingredient", "Unit", "On Hand", "Min", "Status"],
            body: (ingredients ?? []).map((i) => [
              i.name, i.unit, String(i.current_stock), String(i.min_threshold),
              Number(i.current_stock) <= Number(i.min_threshold) ? "LOW" : "OK",
            ]),
          },
        ],
      };
    }

    // staff-attendance
    const { data: logs = [] } = await supabase
      .from("attendance_logs")
      .select("full_name, action, created_at")
      .eq("hotel_id", hotelId)
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });

    const staffMap: Record<string, { ins: number; outs: number }> = {};
    (logs ?? []).forEach((l) => {
      const name = l.full_name || "Unknown";
      if (!staffMap[name]) staffMap[name] = { ins: 0, outs: 0 };
      if (l.action === "clock_in") staffMap[name].ins += 1;
      else staffMap[name].outs += 1;
    });

    return {
      title: "Staff Attendance Report",
      periodLabel: label,
      summary: [
        { label: "Total Logs", value: String((logs ?? []).length) },
        { label: "Staff Active", value: String(Object.keys(staffMap).length) },
        { label: "Clock-ins", value: String(Object.values(staffMap).reduce((s, v) => s + v.ins, 0)) },
        { label: "Clock-outs", value: String(Object.values(staffMap).reduce((s, v) => s + v.outs, 0)) },
      ],
      tables: [
        { title: "Per-Staff Summary", head: ["Staff", "Clock-ins", "Clock-outs"],
          body: Object.entries(staffMap).map(([name, v]) => [name, String(v.ins), String(v.outs)]),
        },
        { title: "Detailed Log (latest 50)", head: ["When", "Staff", "Action"],
          body: (logs ?? []).slice(0, 50).map((l) => [
            format(new Date(l.created_at), "dd MMM hh:mm a"),
            l.full_name || "—",
            l.action === "clock_in" ? "Clock In" : "Clock Out",
          ]),
        },
      ],
    };
  }

  async function handlePreview(key: ReportKey) {
    setBusy(`preview-${key}`);
    try {
      const r = await buildReport(key);
      setPreviewData({ summary: r.summary, tables: r.tables });
      setPreviewKey(key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to build report");
    } finally {
      setBusy(null);
    }
  }

  async function handlePdf(key: ReportKey) {
    setBusy(`pdf-${key}`);
    try {
      const r = await buildReport(key);
      const doc = generatePdfReport({
        title: r.title,
        subtitle: hotel?.address || "",
        hotelName: hotel?.name,
        periodLabel: r.periodLabel,
        summary: r.summary,
        tables: r.tables,
      });
      downloadPdf(doc, `${key}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setBusy(null);
    }
  }

  async function handleCsv(key: ReportKey) {
    setBusy(`csv-${key}`);
    try {
      const r = await buildReport(key);
      const rows: (string | number)[][] = [];
      rows.push([r.title]);
      rows.push([`Period: ${r.periodLabel}`, `Hotel: ${hotel?.name ?? ""}`]);
      rows.push([]);
      r.summary.forEach((s) => rows.push([s.label, s.value]));
      r.tables.forEach((t) => {
        rows.push([]);
        if (t.title) rows.push([t.title]);
        rows.push(t.head);
        t.body.forEach((b) => rows.push(b));
      });
      downloadCSV(`${key}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, rows);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate CSV");
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail(key: ReportKey) {
    if (!user?.email) { toast.error("No email on file"); return; }
    setBusy(`email-${key}`);
    try {
      const r = await buildReport(key);
      const doc = generatePdfReport({
        title: r.title,
        subtitle: hotel?.address || "",
        hotelName: hotel?.name,
        periodLabel: r.periodLabel,
        summary: r.summary,
        tables: r.tables,
      });
      const dataUri = doc.output("datauristring");
      const base64 = dataUri.split(",")[1];

      const summaryHtml = r.summary.map((s) => `<tr><td style="padding:6px 12px;color:#64748b">${s.label}</td><td style="padding:6px 12px;font-weight:600">${s.value}</td></tr>`).join("");
      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:10px 20px;border-radius:999px;font-weight:700">SpeedoBill</div>
          </div>
          <h2 style="color:#fff;margin:0 0 4px">${r.title}</h2>
          <p style="color:#94a3b8;margin:0 0 20px">${hotel?.name ?? ""} • ${r.periodLabel}</p>
          <table style="width:100%;border-collapse:collapse;background:#131c35;border-radius:8px;overflow:hidden">${summaryHtml}</table>
          <p style="color:#94a3b8;font-size:13px;margin:20px 0 0">📎 PDF report attached.</p>
        </div>`;

      const { data, error } = await supabase.functions.invoke("send-report", {
        body: {
          subject: `${r.title} — ${r.periodLabel}`,
          html,
          attachment_base64: base64,
          attachment_filename: `${key}-${format(new Date(), "yyyyMMdd")}.pdf`,
        },
      });
      if (error) throw error;
      toast.success(`Emailed to ${data?.sent_to ?? user.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Pre-built downloadable reports — preview, PDF, CSV, or email.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.key} className="border-border/50 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg bg-secondary/60 ${r.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {r.badge && <Badge variant="secondary">{r.badge}</Badge>}
                </div>
                <CardTitle className="text-base mt-3">{r.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pt-0">
                <Button size="sm" variant="secondary" disabled={busy?.endsWith(r.key)} onClick={() => handlePreview(r.key)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button size="sm" disabled={busy?.endsWith(r.key)} onClick={() => handlePdf(r.key)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button size="sm" variant="outline" disabled={busy?.endsWith(r.key)} onClick={() => handleCsv(r.key)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button size="sm" variant="outline" disabled={busy?.endsWith(r.key)} onClick={() => handleEmail(r.key)}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!previewKey} onOpenChange={(o) => !o && setPreviewKey(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {previewKey && REPORTS.find((r) => r.key === previewKey)?.title}
            </DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {previewData.summary.map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/50 p-3 bg-secondary/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                    <p className="text-lg font-bold mt-1 truncate">{s.value}</p>
                  </div>
                ))}
              </div>
              {previewData.tables.map((t, i) => (
                <div key={i}>
                  {t.title && <h3 className="font-semibold text-sm mb-2">{t.title}</h3>}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>{t.head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.body.slice(0, 50).map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((c, ci) => <TableCell key={ci} className="text-xs">{c}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {t.body.length > 50 && <p className="text-xs text-muted-foreground mt-2">…{t.body.length - 50} more rows in PDF/CSV</p>}
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Button onClick={() => previewKey && handlePdf(previewKey)} disabled={!!busy}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => previewKey && handleCsv(previewKey)} disabled={!!busy}>
                  <FileSpreadsheet className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" onClick={() => previewKey && handleEmail(previewKey)} disabled={!!busy}>
                  <Mail className="h-4 w-4" /> Email me
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
