import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, Copy } from "lucide-react";

const StaffPage = () => {
  const { hotelId } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      const [staffRes, hotelRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("hotel_id", hotelId),
        supabase.from("hotels").select("hotel_code").eq("id", hotelId).single(),
      ]);
      setStaff(staffRes.data || []);
      setHotel(hotelRes.data);
      setLoading(false);
    })();
  }, [hotelId]);

  const toggleActive = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: !current }).eq("user_id", userId);
    if (error) toast.error("Update failed");
    else {
      toast.success(current ? "Staff deactivated" : "Staff activated");
      setStaff(prev => prev.map(s => s.user_id === userId ? { ...s, is_active: !current } : s));
    }
  };

  const copyCode = () => {
    if (hotel?.hotel_code) {
      navigator.clipboard.writeText(hotel.hotel_code);
      toast.success("Hotel code copied! Share with staff to join.");
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Staff</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hotel Code:</span>
          <Badge variant="outline" className="font-mono">{hotel?.hotel_code}</Badge>
          <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Share your hotel code with staff. They sign up as Waiter/Chef and enter this code to join.</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Team Members ({staff.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.full_name || "Unnamed"}</td>
                    <td className="p-3"><Badge variant="outline" className="capitalize">{s.role}</Badge></td>
                    <td className="p-3">
                      <Badge variant={s.is_active ? "default" : "secondary"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {s.role !== "owner" && (
                        <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.user_id, s.is_active)} />
                      )}
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No staff members yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffPage;
