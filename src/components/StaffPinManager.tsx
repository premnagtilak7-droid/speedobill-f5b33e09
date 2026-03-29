/**
 * Owner component to assign/reset staff PINs.
 * Used inside StaffPage or Settings.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, RotateCcw, Shield } from "lucide-react";

interface StaffForPin {
  user_id: string;
  full_name: string;
  role: string;
  has_pin: boolean;
}

async function hashPin(pin: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + userId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function StaffPinManager() {
  const { hotelId } = useAuth();
  const [staff, setStaff] = useState<StaffForPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffForPin | null>(null);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStaff = async () => {
    if (!hotelId) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, role")
      .eq("hotel_id", hotelId)
      .eq("is_active", true)
      .neq("role", "owner");

    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);
    const { data: pins } = await supabase
      .from("staff_pins" as any)
      .select("user_id")
      .in("user_id", userIds);

    const pinSet = new Set((pins || []).map((p: any) => p.user_id));
    setStaff(profiles.map(p => ({
      ...p,
      full_name: p.full_name || "Staff",
      role: p.role || "waiter",
      has_pin: pinSet.has(p.user_id),
    })));
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, [hotelId]);

  const openSetPin = (s: StaffForPin) => {
    setSelectedStaff(s);
    setNewPin("");
    setDialogOpen(true);
  };

  const savePin = async () => {
    if (!selectedStaff || !hotelId) return;
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    setSaving(true);
    const pinHash = await hashPin(newPin, selectedStaff.user_id);

    if (selectedStaff.has_pin) {
      // Update existing
      const { error } = await supabase
        .from("staff_pins" as any)
        .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null } as any)
        .eq("user_id", selectedStaff.user_id);
      if (error) toast.error("Failed to update PIN");
      else toast.success(`PIN updated for ${selectedStaff.full_name}`);
    } else {
      // Insert new
      const { error } = await supabase
        .from("staff_pins" as any)
        .insert({
          user_id: selectedStaff.user_id,
          hotel_id: hotelId,
          pin_hash: pinHash,
        } as any);
      if (error) toast.error("Failed to set PIN: " + error.message);
      else toast.success(`PIN set for ${selectedStaff.full_name}`);
    }
    setSaving(false);
    setDialogOpen(false);
    fetchStaff();
  };

  const resetLock = async (userId: string) => {
    await supabase
      .from("staff_pins" as any)
      .update({ failed_attempts: 0, locked_until: null } as any)
      .eq("user_id", userId);
    toast.success("Lock reset");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading staff...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Staff PIN Management</h3>
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff members found.</p>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.user_id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{s.full_name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{s.role}</Badge>
                {s.has_pin ? (
                  <Badge className="bg-success/10 text-success text-[10px]">PIN Set</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">No PIN</Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openSetPin(s)}>
                  <Key className="h-3 w-3 mr-1" /> {s.has_pin ? "Reset" : "Set"} PIN
                </Button>
                {s.has_pin && (
                  <Button size="sm" variant="ghost" onClick={() => resetLock(s.user_id)} title="Reset lock">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedStaff?.has_pin ? "Reset" : "Set"} PIN for {selectedStaff?.full_name}</DialogTitle>
            <DialogDescription>Enter a 4-digit PIN for quick staff login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              placeholder="Enter 4-digit PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
            <Button className="w-full" disabled={newPin.length !== 4 || saving} onClick={savePin}>
              {saving ? "Saving..." : "Save PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
