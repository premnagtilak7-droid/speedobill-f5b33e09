import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";

/**
 * Public white-label entry point: /menu/:hotelId/:tableNumber
 * Resolves to the existing CustomerOrder page at /order/:tableId
 */
const MenuRedirect = () => {
  const { hotelId, tableNumber } = useParams<{ hotelId: string; tableNumber: string }>();
  const [tableId, setTableId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hotelId || !tableNumber) {
        setError(true);
        return;
      }
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("qr-order", {
          body: { action: "resolve_table", hotel_id: hotelId, table_number: Number(tableNumber) },
        });
        if (cancelled) return;
        if (fnErr || !data?.table_id) {
          setError(true);
          return;
        }
        setTableId(data.table_id);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, tableNumber]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Invalid Table</h1>
          <p className="text-muted-foreground">
            This QR code is not valid. Please scan the QR code on your table.
          </p>
        </div>
      </div>
    );
  }

  if (tableId) return <Navigate to={`/order/${tableId}`} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto" />
        <p className="text-muted-foreground">Loading menu…</p>
      </div>
    </div>
  );
};

export default MenuRedirect;
