import { useState, useEffect } from "react";
import { APP_VERSION, APP_NAME, COMPANY_NAME } from "@/constants/version";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { Settings, Copy, Key, Shield, FileText, ExternalLink, Volume2, Upload, Image as ImageIcon, QrCode, Trash2, Clock, Bell, Receipt } from "lucide-react";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { useNavigate } from "react-router-dom";
import { setNotificationVolume, getNotificationVolume, playLoudBell } from "@/lib/notification-sounds";
import { useAudioNotification, DEFAULT_BELL_SOUND_URL } from "@/contexts/AudioNotificationContext";
import { convertToWebP } from "@/lib/image-utils";
import OperatingHoursEditor, { DEFAULT_HOURS, type OperatingHours } from "@/components/settings/OperatingHoursEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BUSINESS_TYPES = ["Restaurant", "Hotel", "Cafe", "Canteen", "Retail"] as const;
const HEADER_STYLES = [
  { value: "plain", label: "Plain" },
  { value: "bold", label: "Bold" },
  { value: "centered", label: "Centered & Bold" },
] as const;

interface NotificationPrefs {
  daily_summary: boolean;
  low_stock: boolean;
  new_order: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = { daily_summary: false, low_stock: true, new_order: false };

const SettingsPage = () => {
  const { user, hotelId } = useAuth();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  // Hotel info
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [businessType, setBusinessType] = useState<string>("Restaurant");

  // Billing & tax
  const [taxPercent, setTaxPercent] = useState("5");
  const [gstEnabled, setGstEnabled] = useState(false);
  const [easyVoid, setEasyVoid] = useState(false);
  const [counterBilling, setCounterBilling] = useState(false);
  const [autoCleanup, setAutoCleanup] = useState(true);

  // Branding & receipt
  const [logoUrl, setLogoUrl] = useState("");
  const [upiId, setUpiId] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you! Visit again.");
  const [showGstOnReceipt, setShowGstOnReceipt] = useState(true);
  const [receiptHeaderStyle, setReceiptHeaderStyle] = useState<string>("bold");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Operating hours
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS);

  // Sound volume
  const [volume, setVolume] = useState(getNotificationVolume());

  // Push notification bell sound
  const { isAudioEnabled, bellUrl, setBellUrl, enableAudio, testBell } = useAudioNotification();
  const [bellInput, setBellInput] = useState(bellUrl);
  useEffect(() => { setBellInput(bellUrl); }, [bellUrl]);

  useEffect(() => {
    if (!hotelId || !user) return;
    (async () => {
      const [hotelRes, profileRes] = await Promise.all([
        supabase.from("hotels").select("*").eq("id", hotelId).single(),
        supabase.from("profiles").select("notification_preferences").eq("user_id", user.id).maybeSingle(),
      ]);
      const data: any = hotelRes.data;
      if (data) {
        setHotel(data);
        setName(data.name);
        setAddress(data.address || "");
        setPhone(data.phone || "");
        setGstNumber(data.gst_number || "");
        setBusinessType(data.business_type || "Restaurant");
        setTaxPercent(String(data.tax_percent));
        setGstEnabled(data.gst_enabled);
        setEasyVoid(data.easy_void_enabled);
        setCounterBilling(data.counter_billing_enabled);
        setAutoCleanup(data.auto_cleanup_after_bill);
        setLogoUrl(data.logo_url || "");
        setUpiId(data.upi_id || "");
        setReceiptFooter(data.receipt_footer || "Thank you! Visit again.");
        setShowGstOnReceipt(data.show_gst_on_receipt ?? true);
        setReceiptHeaderStyle(data.receipt_header_style || "bold");
        if (data.operating_hours && typeof data.operating_hours === "object") {
          setHours({ ...DEFAULT_HOURS, ...(data.operating_hours as OperatingHours) });
        }
      }
      const prefs = (profileRes.data as any)?.notification_preferences;
      if (prefs && typeof prefs === "object") setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...prefs });
      setLoading(false);
    })();
  }, [hotelId, user]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hotelId) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setUploadingLogo(true);
    try {
      const { blob, ext } = await convertToWebP(file, 400, 0.85);
      const path = `${hotelId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
      const url = urlData.publicUrl + "?t=" + Date.now();
      setLogoUrl(url);
      await supabase.from("hotels").update({ logo_url: url } as any).eq("id", hotelId);
      toast.success("Logo uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    }
    setUploadingLogo(false);
  };

  const validatePhone = (val: string): string | null => {
    if (!val) return null;
    const digits = val.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return "Phone must be 7–15 digits";
    if (!/^[\d\s+\-()]{0,20}$/.test(val)) return "Phone contains invalid characters";
    return null;
  };

  const validateGst = (val: string): string | null => {
    if (!val) return null;
    // Indian GSTIN format: 15 chars: 2 digits + 10 alphanumeric (PAN) + 1 digit + 1 letter + 1 alphanumeric
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/.test(val.toUpperCase())) {
      return "Invalid GSTIN (e.g. 27AABCS1234M1Z5)";
    }
    return null;
  };

  const saveSettings = async () => {
    if (!hotelId || !user) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedGst = gstNumber.trim().toUpperCase();
    const parsedTax = parseFloat(taxPercent);

    if (!trimmedName) { toast.error("Hotel name is required"); return; }
    if (trimmedName.length > 100) { toast.error("Hotel name too long (max 100 chars)"); return; }
    const phoneErr = validatePhone(trimmedPhone);
    if (phoneErr) { toast.error(phoneErr); return; }
    const gstErr = validateGst(trimmedGst);
    if (gstErr) { toast.error(gstErr); return; }
    if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) { toast.error("Tax must be 0-100%"); return; }
    if (upiId.length > 100) { toast.error("UPI ID too long"); return; }
    if (receiptFooter.length > 200) { toast.error("Receipt footer too long (max 200 chars)"); return; }

    setSaving(true);

    const [hotelUpd, profileUpd] = await Promise.all([
      supabase.from("hotels").update({
        name: trimmedName,
        address: address.trim(),
        phone: trimmedPhone,
        gst_number: trimmedGst,
        business_type: businessType,
        tax_percent: parsedTax || 5,
        gst_enabled: gstEnabled,
        easy_void_enabled: easyVoid,
        counter_billing_enabled: counterBilling,
        auto_cleanup_after_bill: autoCleanup,
        upi_id: upiId.trim(),
        receipt_footer: receiptFooter.trim(),
        show_gst_on_receipt: showGstOnReceipt,
        receipt_header_style: receiptHeaderStyle,
        operating_hours: hours,
      } as any).eq("id", hotelId),
      supabase.from("profiles").update({
        notification_preferences: notifPrefs as any,
      }).eq("user_id", user.id),
    ]);

    const err = hotelUpd.error || profileUpd.error;
    if (err) {
      toast.error("Save failed: " + err.message);
    } else {
      toast.success("Settings saved!");
      void writeAudit({
        hotelId, action: "settings_changed", performedBy: user.id,
        performerName: user.email || null,
        details: `Hotel settings updated (GST ${gstEnabled ? "on" : "off"}, tax ${parsedTax || 5}%)`,
      });
    }
    setSaving(false);
  };

  const activateLicense = async () => {
    if (!licenseKey.trim() || !hotelId) return;
    setActivating(true);
    const { data: lic, error } = await supabase
      .from("licenses").select("*")
      .eq("key_code", licenseKey.trim().toUpperCase())
      .eq("is_used", false).maybeSingle();

    if (error || !lic) {
      toast.error("Invalid or already used license key");
      setActivating(false); return;
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + lic.duration_days * 86400000);
    const planLabel = lic.tier === "premium" ? "Premium" : "Basic";
    const expiryStr = expiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    try {
      const [licUpdate, hotelUpdate, profileUpdate] = await Promise.all([
        supabase.from("licenses").update({
          is_used: true, used_at: now.toISOString(), used_by_hotel_id: hotelId,
        }).eq("id", lic.id),
        supabase.from("hotels").update({
          subscription_tier: lic.tier === "premium" ? "premium" : "basic",
          subscription_start_date: now.toISOString(),
          subscription_expiry: expiry.toISOString(),
        } as any).eq("id", hotelId),
        supabase.from("profiles").update({
          subscription_status: "active",
          subscription_plan: lic.tier,
          subscription_expires_at: expiry.toISOString(),
        }).eq("user_id", user?.id),
      ]);

      if (licUpdate.error || hotelUpdate.error || profileUpdate.error) {
        const errMsg = licUpdate.error?.message || hotelUpdate.error?.message || profileUpdate.error?.message || "Unknown error";
        throw new Error(errMsg);
      }

      toast.success(`✅ ${planLabel} plan activated! Valid until ${expiryStr}`, { duration: 6000 });
      setLicenseKey("");
      const { data: refreshed } = await supabase.from("hotels").select("*").eq("id", hotelId).single();
      if (refreshed) setHotel(refreshed);
    } catch (err: any) {
      toast.error("Activation failed: " + err.message, {
        action: { label: "Retry", onClick: () => activateLicense() },
      });
    }
    setActivating(false);
  };

  const copyCode = () => {
    if (hotel?.hotel_code) {
      navigator.clipboard.writeText(hotel.hotel_code);
      toast.success("Hotel code copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" /> Settings
      </h1>

      {/* Hotel Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Hotel Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hotel Code:</span>
            <Badge variant="outline" className="font-mono">{hotel?.hotel_code}</Badge>
            <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hotel Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Restaurant" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main Street, Pune, Maharashtra"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">GST Number (GSTIN)</label>
              <Input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 27AABCS1234M1Z5"
                maxLength={15}
                className="uppercase font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Business Type</label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding & Receipt */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Branding & Receipt</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Hotel Logo (shown on receipts)</label>
            <div className="flex items-center gap-4">
              {logoUrl && <img src={logoUrl} alt="Hotel logo" className="h-12 w-auto rounded border border-border object-contain" />}
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploadingLogo}>
                  <span><Upload className="h-3.5 w-3.5 mr-1" />{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                </Button>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
          {/* UPI ID */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><QrCode className="h-3 w-3" /> UPI ID (for payment QR on bills)</label>
            <Input placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">e.g. nagtilakprem@okaxis — QR code auto-generated on every bill</p>
          </div>
          {/* Footer Message */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> Receipt Footer Message</label>
            <Input
              placeholder="Thank you for dining with us!"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              maxLength={200}
            />
          </div>
          {/* Header style */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Receipt Header Style</label>
            <Select value={receiptHeaderStyle} onValueChange={setReceiptHeaderStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HEADER_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Show GST */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Show GST on receipt</p>
              <p className="text-[10px] text-muted-foreground">Display GSTIN and tax breakdown on printed bills</p>
            </div>
            <Switch checked={showGstOnReceipt} onCheckedChange={setShowGstOnReceipt} />
          </div>
        </CardContent>
      </Card>

      {/* Billing & Tax */}
      <Card>
        <CardHeader><CardTitle className="text-base">Billing & Tax</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 max-w-[200px]">
            <label className="text-xs text-muted-foreground">Tax %</label>
            <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Enable GST</span>
            <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Easy Void (staff can void items)</span>
            <Switch checked={easyVoid} onCheckedChange={setEasyVoid} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Counter Billing</span>
            <Switch checked={counterBilling} onCheckedChange={setCounterBilling} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Auto-cleanup after bill</span>
            <Switch checked={autoCleanup} onCheckedChange={setAutoCleanup} />
          </div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Operating Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatingHoursEditor value={hours} onChange={setHours} />
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Email me daily summary</p>
              <p className="text-[10px] text-muted-foreground">Sales & orders recap delivered each evening</p>
            </div>
            <Switch checked={notifPrefs.daily_summary} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, daily_summary: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Email me when low stock</p>
              <p className="text-[10px] text-muted-foreground">Alert when ingredients hit minimum threshold</p>
            </div>
            <Switch checked={notifPrefs.low_stock} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, low_stock: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Email me when new order</p>
              <p className="text-[10px] text-muted-foreground">Receive an email for each incoming order</p>
            </div>
            <Switch checked={notifPrefs.new_order} onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, new_order: v })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveSettings} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Settings"}
      </Button>

      {/* License Activation */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> Activate License</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="SB-XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="font-mono"
            />
            <Button onClick={activateLicense} disabled={activating || !licenseKey.trim()}>
              {activating ? "Activating..." : "Activate"}
            </Button>
          </div>
          {hotel?.subscription_expiry && (
            <div className="mt-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                Plan: <strong className="capitalize">{hotel.subscription_tier}</strong> · Expires: {new Date(hotel.subscription_expiry).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Volume */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Volume2 className="h-4 w-4" /> Notification Volume</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Slider
              value={[volume * 100]}
              max={100}
              step={5}
              onValueChange={([v]) => {
                const newVol = v / 100;
                setVolume(newVol);
                setNotificationVolume(newVol);
              }}
              className="flex-1"
            />
            <span className="text-sm font-mono w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => playLoudBell()}>
            Test Sound
          </Button>
        </CardContent>
      </Card>

      {/* Push Notification Bell Sound */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Push Notification Sound
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="text-xs">
              <p className="font-medium text-foreground">
                Audio status:{" "}
                {isAudioEnabled ? (
                  <span className="text-emerald-500">Unlocked ✓</span>
                ) : (
                  <span className="text-amber-500">Locked — tap to unlock</span>
                )}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Browsers require a tap before alerts can play sound.
              </p>
            </div>
            {!isAudioEnabled && (
              <Button size="sm" onClick={() => void enableAudio()}>
                Unlock
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Bell sound URL <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={bellInput}
              placeholder={DEFAULT_BELL_SOUND_URL}
              onChange={(e) => setBellInput(e.target.value)}
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground">
              Paste a public Supabase Storage URL for{" "}
              <code className="text-foreground/80">kitchen_bell.mp3</code>, or leave blank
              to use the bundled default.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBellUrl(bellInput);
                toast.success("Bell sound saved");
              }}
            >
              Save URL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!isAudioEnabled) {
                  const ok = await enableAudio();
                  if (!ok) {
                    toast.error("Tap again to unlock audio first.");
                    return;
                  }
                }
                await testBell();
                toast.success("🔔 Test bell played");
              }}
            >
              <Volume2 className="h-3.5 w-3.5 mr-1.5" /> Test Sound
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBellInput(DEFAULT_BELL_SOUND_URL);
                setBellUrl(DEFAULT_BELL_SOUND_URL);
                toast.success("Reset to default bell");
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Install App */}
      <InstallAppPrompt />

      {/* Legal & Compliance */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Legal & Compliance</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Required for Play Store / App Store compliance.</p>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/privacy")}>
            Privacy Policy <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/terms")}>
            Terms & Conditions <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete Account</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">Delete My Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, profile, and all associated hotel data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) { toast.error("Not authenticated"); return; }
                    const { error } = await supabase.functions.invoke("delete-account", {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (error) throw error;
                    toast.success("Account deleted. Goodbye!");
                    await supabase.auth.signOut();
                    navigate("/auth");
                  } catch (err: any) {
                    toast.error("Delete failed: " + (err.message || "Unknown error"));
                  }
                }}>
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Rate us */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Enjoying SpeedoBill?</p>
            <p className="text-xs text-muted-foreground">Leave us a review on the Play Store ⭐</p>
          </div>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">Rate us</Button>
          </a>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center space-y-2 pb-4">
        <a href="https://speedobill.in/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Privacy Policy</a>
        <p className="text-[10px] text-muted-foreground">
          {APP_NAME} v{APP_VERSION} · © {new Date().getFullYear()} {COMPANY_NAME}
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
