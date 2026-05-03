import { useEffect, useState, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface Props {
  hotelId: string;
}

interface BdayCustomer {
  id: string;
  name: string;
  phone: string;
  birthday: string;
  daysUntil: number; // 0 = today, 1..7 = upcoming
}

// returns days until next occurrence of MM-DD (0..365)
const daysUntilBirthday = (birthdayIso: string): number => {
  const [, m, d] = birthdayIso.split("-").map(Number);
  if (!m || !d) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next.getTime() < today.getTime()) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const BirthdayAlerts = forwardRef<HTMLDivElement, Props>(({ hotelId }, _ref) => {
  const [bdays, setBdays] = useState<BdayCustomer[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, birthday")
        .eq("hotel_id", hotelId)
        .not("birthday", "is", null);

      const upcoming = (data || [])
        .map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          birthday: c.birthday as string,
          daysUntil: daysUntilBirthday(c.birthday as string),
        }))
        .filter((c) => c.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 4);

      setBdays(upcoming);
    })();
  }, [hotelId]);

  if (bdays.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4 animate-pop-in glass-card cursor-pointer"
      style={{ border: "1px solid rgba(236,72,153,0.25)" }}
      onClick={() => navigate("/customers")}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-pink-500/15 text-pink-400 ring-1 ring-inset ring-pink-500/30">
          <Cake size={15} />
        </div>
        <span className="text-sm font-semibold text-foreground">Birthday Alerts</span>
        <Badge className="ml-auto text-[10px] bg-pink-500/15 text-pink-400 border-0">
          {bdays.length} upcoming
        </Badge>
      </div>
      <div className="space-y-1.5">
        {bdays.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-[13px] py-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">🎂</span>
              <span className="font-medium text-foreground truncate">{b.name}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{b.phone}</span>
            </div>
            <span className={`text-[11px] font-semibold tnum shrink-0 ${
              b.daysUntil === 0 ? "text-pink-400" : "text-muted-foreground"
            }`}>
              {b.daysUntil === 0 ? "Today!" : b.daysUntil === 1 ? "Tomorrow" : `in ${b.daysUntil}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

BirthdayAlerts.displayName = "BirthdayAlerts";

export default BirthdayAlerts;
