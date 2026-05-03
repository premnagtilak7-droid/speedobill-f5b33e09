import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, Check, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import Papa from "papaparse";

interface Props {
  compact?: boolean;
  hotelId: string;
  existingCategories: string[];
  onComplete: () => void;
}

interface ParsedRow {
  name: string;
  price: number;
  category: string;
  selected: boolean;
}

const BulkMenuUpload = ({ compact, hotelId, onComplete }: Props) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error(`CSV parse error: ${results.errors[0].message}`);
          return;
        }
        const parsed: ParsedRow[] = results.data
          .map((row: any) => ({
            name: String(row.name || row.Name || row.item || row.Item || "").trim(),
            price: Number(row.price || row.Price || row.cost || row.Cost || 0),
            category: String(row.category || row.Category || row.type || row.Type || "General").trim(),
            selected: true,
          }))
          .filter((r) => r.name.length > 0);

        if (parsed.length === 0) {
          toast.error("No valid items found. Ensure CSV has 'name' and 'price' columns.");
          return;
        }
        setRows(parsed);
        toast.success(`${parsed.length} items parsed from CSV`);
      },
      error: (err) => {
        toast.error("Failed to read CSV: " + err.message);
      },
    });
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const saveAll = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("No items selected");
      return;
    }
    setSaving(true);
    try {
      const inserts = selected.map((r) => ({
        hotel_id: hotelId,
        name: r.name,
        price: r.price,
        category: r.category || "General",
      }));
      const { error } = await supabase.from("menu_items").insert(inserts);
      if (error) throw error;
      toast.success(`${selected.length} items added to menu!`);
      onComplete();
      setOpen(false);
      setRows([]);
    } catch (err: any) {
      toast.error("Save failed: " + (err.message || "Unknown error"));
    }
    setSaving(false);
  };

  const downloadTemplate = () => {
    const csv = "name,price,category\nPaneer Tikka,180,Starters\nDal Makhani,220,Main Course\nGulab Jamun,80,Desserts";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "menu_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <>
      <Button variant="outline" size="sm" className={compact ? "h-8 text-xs gap-1" : "gap-1"} onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> {compact ? "CSV Upload" : "Bulk Upload"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRows([]); }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> CSV Menu Upload
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            {rows.length === 0 ? (
              <div className="space-y-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors active:scale-[0.98]"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tap to select CSV file</span>
                  <span className="text-[10px] text-muted-foreground/60">Columns: name, price, category</span>
                </button>
                <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Download CSV Template
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs sm:text-sm font-semibold px-1">
                  {rows.length} items · {selectedCount} selected
                </p>
                <ScrollArea className="flex-1 min-h-0 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {rows.map((row, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleRow(idx)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          row.selected ? "bg-primary/5 border-primary/20" : "opacity-50 border-transparent"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          row.selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}>
                          {row.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.name}</p>
                          <p className="text-[10px] text-muted-foreground">{row.category}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary shrink-0">₹{row.price}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" className="flex-1 h-10" onClick={() => { setRows([]); fileRef.current?.click(); }}>
                    Re-upload
                  </Button>
                  <Button className="flex-1 h-10 gap-1.5 font-semibold" onClick={saveAll} disabled={saving || selectedCount === 0}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Add {selectedCount} Items
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkMenuUpload;
