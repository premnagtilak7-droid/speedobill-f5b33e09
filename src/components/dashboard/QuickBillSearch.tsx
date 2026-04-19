import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Receipt, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Props {
  hotelId: string;
}

interface BillResult {
  id: string;
  total: number;
  billed_at: string | null;
  created_at: string;
  status: string;
  table_number?: number;
  customer_name?: string;
}

const QuickBillSearch = ({ hotelId }: Props) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BillResult[]>([]);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!q.trim() || !hotelId) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const term = q.trim();
      const isNumeric = /^\d+$/.test(term);

      // Fetch candidate orders + tables + customers
      const [ordersRes, tablesRes, customersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, billed_at, created_at, status, table_id, customer_id")
          .eq("hotel_id", hotelId)
          .order("created_at", { ascending: false })
          .limit(60),
        isNumeric
          ? supabase
              .from("restaurant_tables")
              .select("id, table_number")
              .eq("hotel_id", hotelId)
              .eq("table_number", parseInt(term))
          : Promise.resolve({ data: [] as { id: string; table_number: number }[] }),
        supabase
          .from("customers")
          .select("id, name")
          .eq("hotel_id", hotelId)
          .ilike("name", `%${term}%`)
          .limit(10),
      ]);

      const orders = ordersRes.data || [];
      const matchTableIds = new Set((tablesRes.data || []).map((t: any) => t.id));
      const matchCustomerIds = new Set((customersRes.data || []).map((c) => c.id));
      const customerNameMap: Record<string, string> = {};
      (customersRes.data || []).forEach((c) => { customerNameMap[c.id] = c.name; });

      // Need table_number map for ALL displayed orders
      const allTableIds = Array.from(new Set(orders.map((o) => o.table_id).filter(Boolean)));
      let tableNumberMap: Record<string, number> = {};
      if (allTableIds.length > 0) {
        const { data } = await supabase
          .from("restaurant_tables")
          .select("id, table_number")
          .in("id", allTableIds);
        (data || []).forEach((t) => { tableNumberMap[t.id] = t.table_number; });
      }

      // Match by: bill id substring, table number, customer name
      const matched = orders.filter((o) => {
        if (o.id.toLowerCase().includes(term.toLowerCase())) return true;
        if (o.id.replace(/-/g, "").toLowerCase().startsWith(term.toLowerCase())) return true;
        if (matchTableIds.has(o.table_id)) return true;
        if (o.customer_id && matchCustomerIds.has(o.customer_id)) return true;
        return false;
      });

      const out: BillResult[] = matched.slice(0, 8).map((o) => ({
        id: o.id,
        total: Number(o.total),
        billed_at: o.billed_at,
        created_at: o.created_at,
        status: o.status,
        table_number: tableNumberMap[o.table_id],
        customer_name: o.customer_id ? customerNameMap[o.customer_id] : undefined,
      }));
      setResults(out);
      setLoading(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [q, hotelId]);

  const onSelect = (r: BillResult) => {
    setOpen(false);
    setQ("");
    // BillingHistory page lists past bills; Order History also valid. Use billing-history with a hash for the bill id.
    navigate(`/billing-history#${r.id}`);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search bills · table number · customer name…"
          className="pl-9 pr-9 h-10 bg-card/60 border-border/50"
        />
        {q && (
          <button
            onClick={() => { setQ(""); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && q.trim() && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-hidden shadow-2xl glass-card"
          style={{ border: "1px solid hsl(var(--border))" }}
        >
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No bills match "{q}"
            </div>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/40 flex items-center gap-3 border-b border-border/30 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Receipt size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        Bill #{r.id.slice(0, 8).toUpperCase()}
                        {r.table_number != null && (
                          <span className="ml-2 text-[10px] text-muted-foreground">· Table {r.table_number}</span>
                        )}
                        {r.customer_name && (
                          <span className="ml-2 text-[10px] text-muted-foreground">· {r.customer_name}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(r.billed_at || r.created_at), "dd MMM, hh:mm a")} · <span className="capitalize">{r.status}</span>
                      </p>
                    </div>
                    <span className="font-bold text-sm text-foreground tnum shrink-0">
                      ₹{r.total.toFixed(0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickBillSearch;
