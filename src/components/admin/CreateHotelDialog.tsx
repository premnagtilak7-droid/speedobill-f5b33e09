import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Copy, CheckCircle2, Loader2 } from "lucide-react";

interface Prefill {
  hotel_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  business_type?: string;
}

interface Props {
  onCreated?: (info: { hotel_code: string | null; email: string }) => void;
  trigger?: React.ReactNode;
  prefill?: Prefill;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const BUSINESS_TYPES = ["Restaurant", "Cafe", "Cloud Kitchen", "Canteen", "Bar / Pub", "Bakery", "Sweet Shop", "QSR / Fast Food", "Other"];

export const CreateHotelDialog = ({ onCreated, trigger, prefill, open: controlledOpen, onOpenChange }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);

  const [hotelName, setHotelName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState("Restaurant");
  const [tier, setTier] = useState<"free" | "basic" | "premium">("premium");
  const [trialDays, setTrialDays] = useState("30");
  const [password, setPassword] = useState("");

  // Apply prefill whenever dialog opens
  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.hotel_name !== undefined) setHotelName(prefill.hotel_name);
    if (prefill.owner_name !== undefined) setOwnerName(prefill.owner_name);
    if (prefill.email !== undefined) setEmail(prefill.email);
    if (prefill.phone !== undefined) setPhone(prefill.phone);
    if (prefill.city !== undefined) setCity(prefill.city);
    if (prefill.business_type !== undefined && BUSINESS_TYPES.includes(prefill.business_type)) {
      setBusinessType(prefill.business_type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  const [result, setResult] = useState<{ hotel_code: string | null; email: string } | null>(null);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setPassword(pwd);
  };

  const reset = () => {
    setHotelName(""); setOwnerName(""); setEmail(""); setPhone("");
    setCity(""); setBusinessType("Restaurant"); setTier("premium");
    setTrialDays("30"); setPassword(""); setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim() || !email.trim() || !password.trim()) {
      toast.error("Hotel name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-hotel-owner", {
      body: {
        email: email.trim().toLowerCase(),
        password,
        full_name: ownerName.trim(),
        phone: phone.trim(),
        hotel_name: hotelName.trim(),
        city: city.trim(),
        business_type: businessType,
        subscription_tier: tier,
        trial_days: parseInt(trialDays, 10) || 30,
      },
    });
    setLoading(false);

    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to create hotel.");
      return;
    }

    setResult({ hotel_code: (data as any)?.hotel_code ?? null, email: (data as any)?.email ?? email });
    toast.success("Hotel created! Share the credentials with the owner.");
    onCreated?.();
  };

  const copyCredentials = () => {
    const text = `SpeedoBill account ready 🎉\n\nLogin: ${result?.email}\nPassword: ${password}\nHotel Code: ${result?.hotel_code ?? "—"}\n\nSign in at: https://speedobill.lovable.app/auth`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Building2 className="h-4 w-4" /> Create New Hotel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Create New Hotel Account
          </DialogTitle>
          <DialogDescription>
            Onboard a new restaurant. This creates the owner login + hotel + assigns subscription.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <h3 className="text-lg font-bold">Account ready!</h3>
              <p className="text-sm text-muted-foreground">Share these credentials with the owner.</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div><span className="text-muted-foreground">Login email:</span> <span className="font-mono font-semibold">{result.email}</span></div>
              <div><span className="text-muted-foreground">Password:</span> <span className="font-mono font-semibold">{password}</span></div>
              <div><span className="text-muted-foreground">Hotel Code:</span> <span className="font-mono font-semibold">{result.hotel_code ?? "—"}</span></div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={copyCredentials} className="gap-2">
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button onClick={() => { reset(); }}>Create another</Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Hotel / Restaurant Name *</Label>
                <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Spice Garden" maxLength={120} required />
              </div>
              <div className="space-y-1.5">
                <Label>Owner Name</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Rajesh Kumar" maxLength={100} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Owner Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@hotel.com" required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (WhatsApp)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="9876543210" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label>Business Type</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Subscription Tier</Label>
                <Select value={tier} onValueChange={(v: any) => setTier(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic (₹199/mo)</SelectItem>
                    <SelectItem value="premium">Premium (₹499/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trial / Validity (days)</Label>
                <Input type="number" min="0" max="365" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Temporary Password *</Label>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={generatePassword}>
                  Generate strong password
                </Button>
              </div>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
              <p className="text-xs text-muted-foreground">Owner can change this after first login.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><Building2 className="h-4 w-4" /> Create Hotel</>}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateHotelDialog;
