import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  hotelId: string;
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  loyalty_points: number;
  total_visits: number;
  total_spend: number;
}

const TopLoyaltyCustomers = ({ hotelId }: Props) => {
  const [list, setList] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, loyalty_points, total_visits, total_spend")
        .eq("hotel_id", hotelId)
        .order("loyalty_points", { ascending: false })
        .limit(10);
      setList((data as any) || []);
      setLoading(false);
    })();
  }, [hotelId]);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> Top Loyal Customers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No loyalty customers yet. Points are awarded when bills are settled with a linked customer.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {list.map((c, idx) => {
              const rank = idx + 1;
              const isVIP = (c.total_visits || 0) >= 10 || Number(c.total_spend || 0) >= 5000;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="w-full text-left p-3 hover:bg-muted/30 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base font-bold w-7 shrink-0 text-center">{medal}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        {c.name}
                        {isVIP && <Crown className="h-3 w-3 text-amber-400" />}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.phone} · {c.total_visits || 0} visits · ₹{Number(c.total_spend || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary/15 text-primary border-0 tnum shrink-0">
                    {c.loyalty_points} pts
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopLoyaltyCustomers;
