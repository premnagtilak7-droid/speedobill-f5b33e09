import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";

const DataExportDownload = () => {
  const { hotelId } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportTable = async (tableName: string, label: string) => {
    if (!hotelId) return;
    setExporting(tableName);
    try {
      const { data, error } = await supabase.from(tableName as any).select("*").eq("hotel_id", hotelId);
      if (error) throw error;
      if (!data || data.length === 0) { toast.info(`No ${label} data to export`); setExporting(null); return; }

      const headers = Object.keys(data[0]);
      const csv = [headers.join(","), ...data.map(row => headers.map(h => JSON.stringify((row as any)[h] ?? "")).join(","))].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.toLowerCase().replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} exported!`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
    setExporting(null);
  };

  const exports = [
    { table: "orders", label: "Orders" },
    { table: "order_items", label: "Order Items" },
    { table: "daily_expenses", label: "Expenses" },
    { table: "sales", label: "Sales" },
    { table: "menu_items", label: "Menu Items" },
    { table: "ingredients", label: "Ingredients" },
    { table: "customers", label: "Customers" },
    { table: "void_reports", label: "Void Reports" },
    { table: "attendance_logs", label: "Attendance" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Download className="h-6 w-6 text-primary" /> Data Export</h1>
      <p className="text-sm text-muted-foreground">Download your hotel data as CSV files.</p>

      <div className="grid gap-3 md:grid-cols-2">
        {exports.map(e => (
          <Card key={e.table} className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{e.label}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportTable(e.table, e.label)} disabled={exporting === e.table}>
                {exporting === e.table ? "..." : <Download className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DataExportDownload;
