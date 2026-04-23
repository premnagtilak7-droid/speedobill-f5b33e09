/**
 * StaffKiosk
 *
 * Full-screen kiosk overlay shown to staff when Kiosk Mode is active and
 * no staff member is currently signed in. Replaces the entire admin shell.
 *
 * Layout:
 *  - Mobile (≤640px): 2-column grid of staff names
 *  - Tablet/PC: 4-column grid
 *  - Click a name → universal full-screen PIN pad (PinPad component)
 *  - Owner can exit via the "Exit Staff Mode" button (master password gate)
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKioskMode } from "@/hooks/useKioskMode";
import { Button } from "@/components/ui/button";
import { ArrowLeft, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import PinPad from "./PinPad";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StaffOption {
  user_id: string;
  full_name: string;
  role: string;
}

export const StaffKiosk = () => {
  const { hotelId, user, signOut } = useAuth();
  const { exitKiosk, ownerEmail } = useKioskMode();
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [hotelCode, setHotelCode] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Exit dialog
  const [exitOpen, setExitOpen] = useState(false);
  const [exitPassword, setExitPassword] = useState("");
  const [exiting, setExiting] = useState(false);

  const loadStaff = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [profilesRes, hotelRes, pinsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, role, email, is_active")
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabase.from("hotels").select("hotel_code, name").eq("id", hotelId).single(),
        supabase.from("staff_pins").select("user_id"),
      ]);

      const pinUserIds = new Set((pinsRes.data || []).map((r: any) => r.user_id));
      const userIds = (profilesRes.data || []).map((p: any) => p.user_id);

      // Fetch authoritative roles
      let roleMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        (roleRows || []).forEach((r: any) => {
          if (!roleMap[r.user_id] || roleMap[r.user_id] === "owner") {
            roleMap[r.user_id] = r.role;
          }
        });
      }

      const list: StaffOption[] = (profilesRes.data || [])
        .map((p: any) => ({
          user_id: p.user_id,
          full_name:
            (p.full_name && String(p.full_name).trim()) ||
            (p.email ? String(p.email).split("@")[0] : "Staff"),
          role: roleMap[p.user_id] || p.role || "waiter",
        }))
        .filter((s) => s.role !== "owner" && pinUserIds.has(s.user_id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setStaff(list);
      setHotelCode((hotelRes.data as any)?.hotel_code || "");
      setHotelName((hotelRes.data as any)?.name || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (selected && pin.length === 4 && !verifying) {
      void handleVerify(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selected]);

  const handleVerify = async (pinValue: string) => {
    if (!selected || !hotelCode) return;
    setVerifying(true);
    try {
      // Sign the owner out first so we can establish the staff session.
      // The owner's Master Password (cached server-side) is required to exit.
      const { data, error } = await supabase.functions.invoke("verify-staff-pin", {
        body: {
          hotel_code: hotelCode,
          user_id: selected.user_id,
          pin: pinValue,
        },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.token_hash) throw new Error("Login failed.");

      // Sign owner out, then exchange the staff magic link
      await supabase.auth.signOut();
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: payload.token_hash,
      });
      if (verifyErr) throw verifyErr;

      toast.success(`Welcome, ${selected.full_name}!`);
      // Role-based redirect — locked single screen
      const target =
        selected.role === "chef" ? "/kds" : selected.role === "manager" ? "/dashboard" : "/tables";
      window.location.replace(target);
    } catch (err: any) {
      toast.error(err?.message || "Wrong PIN. Please try again.");
      setPin("");
    } finally {
      setVerifying(false);
    }
  };

  const handleExit = async () => {
    if (!exitPassword) {
      toast.error("Enter the owner's password");
      return;
    }
    setExiting(true);
    const ok = await exitKiosk(exitPassword);
    setExiting(false);
    if (ok) {
      toast.success("Staff Mode disabled");
      setExitOpen(false);
      setExitPassword("");
    } else {
      toast.error("Wrong password");
      setExitPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-btn-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm sm:text-base font-bold text-primary">SpeedoBill</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {hotelName ? `${hotelName} · ` : ""}Staff Mode
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExitOpen(true)} className="gap-1.5">
          <LockKeyhole className="h-4 w-4" />
          <span className="hidden sm:inline">Exit Staff Mode</span>
          <span className="sm:hidden">Exit</span>
        </Button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {!selected ? (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Who's working?</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tap your name to sign in with your PIN
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <p className="text-muted-foreground">
                  No active staff with PINs found. Add staff and set their PIN first.
                </p>
                <Button variant="outline" onClick={loadStaff} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
              </div>
            ) : (
              // Mobile: 2 cols; Tablet/PC: 4 cols
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {staff.map((s) => (
                  <button
                    key={s.user_id}
                    onClick={() => {
                      setSelected(s);
                      setPin("");
                    }}
                    className="group relative aspect-square rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-150 active:scale-95 p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-lg min-h-[140px]"
                  >
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center text-2xl sm:text-3xl font-bold text-primary transition-colors">
                      {s.full_name[0].toUpperCase()}
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-foreground text-center line-clamp-2">
                      {s.full_name}
                    </p>
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {s.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Full-screen PIN pad
          <div className="max-w-md mx-auto py-2">
            <button
              onClick={() => {
                setSelected(null);
                setPin("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6"
            >
              <ArrowLeft className="h-4 w-4" /> Back to staff list
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-3xl font-bold text-primary">
                  {selected.full_name[0].toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Hi, {selected.full_name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Enter your 4-digit PIN
              </p>
            </div>

            <PinPad value={pin} length={4} onChange={setPin} disabled={verifying} />

            {verifying && (
              <p className="text-center text-sm text-muted-foreground mt-4">Verifying…</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 backdrop-blur-md px-4 py-2 text-center text-[10px] sm:text-xs text-muted-foreground">
        🔒 Locked to Staff Mode · Owner password required to exit
      </footer>

      {/* Exit dialog — owner master password */}
      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="z-[300]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Owner Master Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              To exit Staff Mode, please re-enter the owner's account password.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="exit-password">Password for {ownerEmail || "owner"}</Label>
              <Input
                id="exit-password"
                type="password"
                value={exitPassword}
                onChange={(e) => setExitPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExit()}
                placeholder="••••••••"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExitOpen(false)} disabled={exiting}>
              Cancel
            </Button>
            <Button onClick={handleExit} disabled={exiting || !exitPassword}>
              {exiting ? "Verifying…" : "Exit Staff Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffKiosk;
