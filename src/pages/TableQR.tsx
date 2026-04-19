import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QrCode, Download, Printer, Share2, Package } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import JSZip from "jszip";

interface TableInfo {
  id: string;
  table_number: number;
  section_name: string;
}

const TableQR = () => {
  const { hotelId } = useAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [hotelName, setHotelName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const [tablesRes, hotelRes] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("id, table_number, section_name")
          .eq("hotel_id", hotelId)
          .order("table_number"),
        supabase.from("hotels").select("name").eq("id", hotelId).maybeSingle(),
      ]);
      setTables(tablesRes.data || []);
      setHotelName(hotelRes.data?.name || "");
      setLoading(false);
    })();
  }, [hotelId]);

  // White-label public menu URL: /menu/:hotelId/:tableNumber
  const getOrderUrl = (table: TableInfo) =>
    `${window.location.origin}/menu/${hotelId}/${table.table_number}`;

  const renderQrPng = (table: TableInfo): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const svg = document.getElementById(`qr-${table.id}`);
      if (!svg) return reject(new Error("QR not found"));
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = 512;
        canvas.height = 640;
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 56, 40, 400, 400);
          ctx.fillStyle = "#1A1A2E";
          ctx.font = "bold 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`Table ${table.table_number}`, 256, 490);
          ctx.font = "16px sans-serif";
          ctx.fillStyle = "#666666";
          ctx.fillText(table.section_name || "", 256, 520);
          ctx.fillText("Scan to order", 256, 548);
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#F97316";
          ctx.fillText("Powered by SpeedoBill", 256, 600);
        }
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Blob fail"));
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Image load fail"));
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });

  const downloadQR = async (table: TableInfo) => {
    try {
      const blob = await renderQrPng(table);
      const link = document.createElement("a");
      link.download = `table-${table.table_number}-qr.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`QR for Table ${table.table_number} downloaded`);
    } catch {
      toast.error("Failed to download QR");
    }
  };

  const downloadAllZip = async () => {
    if (!tables.length) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const t of tables) {
        const blob = await renderQrPng(t);
        zip.file(`table-${t.table_number}-qr.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `speedobill-table-qrs-${Date.now()}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Downloaded ${tables.length} QR codes as ZIP`);
    } catch {
      toast.error("Failed to build ZIP");
    } finally {
      setZipping(false);
    }
  };

  const shareQR = async (table: TableInfo) => {
    const url = getOrderUrl(table);
    if (navigator.share) {
      try { await navigator.share({ title: `Table ${table.table_number} - Order`, url }); } catch {}
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
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Table QR Codes</h1>
              <p className="text-sm text-muted-foreground">
                Print and place at tables — guests scan to order instantly
              </p>
            </div>
          </div>
          {tables.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={downloadAllZip}
                disabled={zipping}
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Package className="h-4 w-4" />
                {zipping ? "Zipping…" : "Download All (ZIP)"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          )}
        </div>

        {tables.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border/60 bg-muted/20">
            <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No tables found. Add tables first from the Tables page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tables.map((table) => (
              <Card
                key={table.id}
                className="overflow-hidden border-border/60 bg-card hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <CardContent className="p-4 text-center space-y-3">
                  <div className="bg-white rounded-xl p-3 inline-block mx-auto ring-1 ring-border/30">
                    <QRCodeSVG
                      id={`qr-${table.id}`}
                      value={getOrderUrl(table)}
                      size={120}
                      level="M"
                      includeMargin={false}
                      fgColor="#1A1A2E"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-base leading-tight">Table {table.table_number}</p>
                    <p className="text-[11px] text-muted-foreground">{table.section_name}</p>
                    <p className="text-[10px] font-semibold text-primary mt-1 tracking-wide">SPEEDOBILL</p>
                  </div>
                  <div className="flex gap-1.5 justify-center pt-1 border-t border-border/40">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => downloadQR(table)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download PNG</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => shareQR(table)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share / copy link</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default TableQR;
