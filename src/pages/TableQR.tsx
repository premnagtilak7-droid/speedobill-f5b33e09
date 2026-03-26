import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Download, Printer, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface TableInfo {
  id: string;
  table_number: number;
  section_name: string;
}

const TableQR = () => {
  const { hotelId } = useAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, section_name")
        .eq("hotel_id", hotelId)
        .order("table_number");
      setTables(data || []);
      setLoading(false);
    })();
  }, [hotelId]);

  const getOrderUrl = (tableId: string) => {
    return `${window.location.origin}/order/${tableId}`;
  };

  const downloadQR = (table: TableInfo) => {
    const svg = document.getElementById(`qr-${table.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 600;
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 56, 30, 400, 400);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Table ${table.table_number}`, 256, 480);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#666666";
        ctx.fillText("Scan to order", 256, 510);
        ctx.fillText(table.section_name, 256, 540);
      }
      const link = document.createElement("a");
      link.download = `table-${table.table_number}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success(`QR for Table ${table.table_number} downloaded`);
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const printAllQR = () => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;

    const html = tables.map((table) => {
      const url = getOrderUrl(table.id);
      return `
        <div style="page-break-inside:avoid;text-align:center;padding:20px;border:1px dashed #ccc;margin:10px;display:inline-block;width:200px;">
          <div id="print-qr-${table.id}"></div>
          <p style="font-weight:bold;font-size:16px;margin:8px 0 2px;">Table ${table.table_number}</p>
          <p style="font-size:11px;color:#666;">${table.section_name}</p>
          <p style="font-size:10px;color:#999;">Scan to order</p>
        </div>
      `;
    }).join("");

    w.document.write(`
      <html><head><title>All Table QR Codes</title>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
      <style>body{font-family:sans-serif;display:flex;flex-wrap:wrap;justify-content:center;}</style>
      </head><body>${html}
      <script>
        ${tables.map(t => `QRCode.toCanvas(document.createElement('canvas'),${JSON.stringify(getOrderUrl(t.id))},{width:160},function(err,canvas){if(!err){document.getElementById('print-qr-${t.id}').appendChild(canvas)}})`).join(";")}
        setTimeout(function(){window.print()},1000);
      <\/script>
      </body></html>
    `);
    w.document.close();
  };

  const shareQR = async (table: TableInfo) => {
    const url = getOrderUrl(table.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Table ${table.table_number} - Order`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Order link copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" /> Table QR Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate QR codes for customers to scan and order from their table
          </p>
        </div>
        {tables.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={printAllQR}>
            <Printer className="h-4 w-4" /> Print All
          </Button>
        )}
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tables found. Add tables first from the Tables page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map((table) => (
            <Card key={table.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4 text-center space-y-3">
                <div className="bg-white rounded-lg p-3 inline-block mx-auto">
                  <QRCodeSVG
                    id={`qr-${table.id}`}
                    value={getOrderUrl(table.id)}
                    size={120}
                    level="M"
                    includeMargin={false}
                    fgColor="#1A1A2E"
                  />
                </div>
                <div>
                  <p className="font-bold text-foreground">Table {table.table_number}</p>
                  <p className="text-[10px] text-muted-foreground">{table.section_name}</p>
                </div>
                <div className="flex gap-1.5 justify-center">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadQR(table)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareQR(table)}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableQR;
