import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Delete, ArrowLeft, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StaffMember {
  user_id: string;
  full_name: string;
  role: string;
  has_pin: boolean;
}

interface StaffPinLoginProps {
  onSuccess: (userId: string) => void;
  onCancel: () => void;
  hotelId: string;
}

const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function StaffPinLogin({ onSuccess, onCancel, hotelId }: StaffPinLoginProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, role")
        .eq("hotel_id", hotelId)
        .eq("is_active", true);

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
    })();
  }, [hotelId]);

  const handleDigit = useCallback((d: string) => {
    if (pin.length >= 4) return;
    setError("");
    setPin(prev => prev + d);
  }, [pin]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  }, []);

  // Auto-submit on 4 digits
  useEffect(() => {
    if (pin.length !== 4 || !selected) return;

    // Check lock
    if (lockedUntil && Date.now() < lockedUntil) {
      const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
      setError(`Locked. Try again in ${mins}m`);
      setPin("");
      return;
    }

    (async () => {
      // Simple hash comparison (SHA-256 of pin)
      const encoder = new TextEncoder();
      const data = encoder.encode(pin + selected.user_id);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: pinRecord } = await supabase
        .from("staff_pins" as any)
        .select("pin_hash, failed_attempts, locked_until")
        .eq("user_id", selected.user_id)
        .maybeSingle();

      if (!pinRecord) {
        setError("No PIN set. Ask owner to assign PIN.");
        setPin("");
        return;
      }

      const rec = pinRecord as any;
      // Check if locked
      if (rec.locked_until && new Date(rec.locked_until).getTime() > Date.now()) {
        const mins = Math.ceil((new Date(rec.locked_until).getTime() - Date.now()) / 60000);
        setError(`Account locked. Try in ${mins}m`);
        setPin("");
        return;
      }

      if (rec.pin_hash === hashHex) {
        // Success - reset attempts
        await supabase
          .from("staff_pins" as any)
          .update({ failed_attempts: 0, locked_until: null } as any)
          .eq("user_id", selected.user_id);
        toast.success(`Welcome, ${selected.full_name}!`);
        onSuccess(selected.user_id);
      } else {
        const newAttempts = (rec.failed_attempts || 0) + 1;
        const updates: any = { failed_attempts: newAttempts };
        if (newAttempts >= MAX_ATTEMPTS) {
          const lockTime = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
          updates.locked_until = lockTime;
          setLockedUntil(Date.now() + LOCK_DURATION_MS);
          setError("Too many attempts. Locked for 5 minutes.");
        } else {
          setError(`Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempts left.`);
        }
        await supabase
          .from("staff_pins" as any)
          .update(updates as any)
          .eq("user_id", selected.user_id);
        setPin("");
        setAttempts(newAttempts);
      }
    })();
  }, [pin, selected, lockedUntil, onSuccess]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "DEL"];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center mesh-gradient-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center mesh-gradient-bg p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm glass-card p-6 space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            {selected ? <Lock className="h-6 w-6 text-primary" /> : <ShieldCheck className="h-6 w-6 text-primary" />}
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {selected ? `Enter PIN` : "Quick Login"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {selected ? selected.full_name : "Select your name to login"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!selected ? (
            /* Staff Selection */
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-2 max-h-64 overflow-y-auto"
            >
              {staff.filter(s => s.has_pin).map(s => (
                <button
                  key={s.user_id}
                  onClick={() => { setSelected(s); setPin(""); setError(""); setAttempts(0); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 bg-primary/10">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {s.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{s.role}</Badge>
                  </div>
                </button>
              ))}
              {staff.filter(s => s.has_pin).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No staff have PINs set up yet.
                  <br />Owner can assign PINs in Staff settings.
                </p>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onCancel}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Login
              </Button>
            </motion.div>
          ) : (
            /* PIN Pad */
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* PIN dots */}
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      i < pin.length
                        ? "bg-primary scale-110"
                        : "bg-muted border-2 border-border"
                    }`}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-destructive text-center font-medium animate-shake">{error}</p>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2">
                {digits.map((d, i) => {
                  if (d === "") return <div key={i} />;
                  if (d === "DEL") {
                    return (
                      <button
                        key={i}
                        onClick={handleDelete}
                        className="h-14 rounded-xl flex items-center justify-center hover:bg-secondary/60 transition-colors"
                      >
                        <Delete className="h-5 w-5 text-muted-foreground" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleDigit(d)}
                      className="h-14 rounded-xl text-xl font-semibold text-foreground hover:bg-secondary/60 active:bg-primary/20 active:scale-95 transition-all"
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { setSelected(null); setPin(""); setError(""); }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Choose Different Staff
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
