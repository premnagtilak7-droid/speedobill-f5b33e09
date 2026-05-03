import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Building2, Clock, ChefHat, UtensilsCrossed, Shield, Pencil, Check, X, Upload, KeyRound, Trash2, IndianRupee, Users } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { convertToWebP } from "@/lib/image-utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StatsState {
  ordersToday: number;
  totalOrders: number;
  revenueToday: number;
  tablesServedToday: number;
}

const StaffProfile = () => {
  const { user, role, hotelId, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [hotelName, setHotelName] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<StatsState>({ ordersToday: 0, totalOrders: 0, revenueToday: 0, tablesServedToday: 0 });
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [editPhone, setEditPhone] = useState(false);
  const [phoneVal, setPhoneVal] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const [editAddress, setEditAddress] = useState(false);
  const [addressVal, setAddressVal] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Change password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (!user || !hotelId) return;
    const load = async () => {
      setLoading(true);
      const [hotelRes, profileRes] = await Promise.all([
        supabase.from("hotels").select("name").eq("id", hotelId).maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setHotelName(hotelRes.data?.name || "Unknown");
      setProfile(profileRes.data);
      setPhoneVal(profileRes.data?.phone || "");
      setAddressVal(profileRes.data?.address || "");

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      // Stats per role
      if (role === "waiter") {
        const [todayOrders, totalOrders, todayRevenue] = await Promise.all([
          supabase.from("orders").select("table_id", { count: "exact" }).eq("hotel_id", hotelId).eq("waiter_id", user.id).gte("created_at", startOfDay),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).eq("waiter_id", user.id),
          supabase.from("orders").select("total").eq("hotel_id", hotelId).eq("waiter_id", user.id).gte("created_at", startOfDay).eq("status", "billed"),
        ]);
        const tablesSet = new Set((todayOrders.data || []).map((o: any) => o.table_id));
        const revenue = (todayRevenue.data || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        setStats({
          ordersToday: todayOrders.count || 0,
          totalOrders: totalOrders.count || 0,
          revenueToday: revenue,
          tablesServedToday: tablesSet.size,
        });
      } else if (role === "chef") {
        const [todayKot, totalKot] = await Promise.all([
          supabase.from("kot_tickets").select("table_id", { count: "exact" }).eq("hotel_id", hotelId).eq("claimed_by", user.id).gte("created_at", startOfDay),
          supabase.from("kot_tickets").select("id", { count: "exact", head: true }).eq("hotel_id", hotelId).eq("claimed_by", user.id),
        ]);
        const tablesSet = new Set((todayKot.data || []).map((k: any) => k.table_id));
        setStats({
          ordersToday: todayKot.count || 0,
          totalOrders: totalKot.count || 0,
          revenueToday: 0,
          tablesServedToday: tablesSet.size,
        });
      } else {
        // owner / manager — show hotel-wide today stats
        const [todayOrders, todayRevenue] = await Promise.all([
          supabase.from("orders").select("table_id", { count: "exact" }).eq("hotel_id", hotelId).gte("created_at", startOfDay),
          supabase.from("orders").select("total").eq("hotel_id", hotelId).gte("created_at", startOfDay).eq("status", "billed"),
        ]);
        const tablesSet = new Set((todayOrders.data || []).map((o: any) => o.table_id));
        const revenue = (todayRevenue.data || []).reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        setStats({
          ordersToday: todayOrders.count || 0,
          totalOrders: 0,
          revenueToday: revenue,
          tablesServedToday: tablesSet.size,
        });
      }
      setLoading(false);
    };
    void load();
  }, [user, hotelId, role]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Staff";
  const userInitials = userName.slice(0, 2).toUpperCase();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Staff";
  const RoleIcon = role === "chef" ? ChefHat : role === "waiter" ? UtensilsCrossed : Shield;
  const joinDate = profile?.join_date ? new Date(profile.join_date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "N/A";
  const accountCreated = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "N/A";

  const validatePhone = (val: string): string | null => {
    if (!val) return null;
    const digits = val.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return "Phone must be 7–15 digits";
    return null;
  };

  const savePhone = async () => {
    if (!user) return;
    const trimmed = phoneVal.trim();
    const err = validatePhone(trimmed);
    if (err) { toast.error(err); return; }
    setSavingPhone(true);
    const { error } = await supabase.from("profiles").update({ phone: trimmed }).eq("user_id", user.id);
    if (error) toast.error("Save failed: " + error.message);
    else {
      setProfile({ ...profile, phone: trimmed });
      setEditPhone(false);
      toast.success("Phone updated");
    }
    setSavingPhone(false);
  };

  const saveAddress = async () => {
    if (!user) return;
    setSavingAddress(true);
    const { error } = await supabase.from("profiles").update({ address: addressVal.trim() }).eq("user_id", user.id);
    if (error) toast.error("Save failed: " + error.message);
    else {
      setProfile({ ...profile, address: addressVal.trim() });
      setEditAddress(false);
      toast.success("Address updated");
    }
    setSavingAddress(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Photo must be under 2MB"); return; }
    setUploadingPhoto(true);
    try {
      const { blob, ext } = await convertToWebP(file, 400, 0.85);
      const path = `profiles/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
      const url = urlData.publicUrl + "?t=" + Date.now();
      const { error: updErr } = await supabase.from("profiles").update({ photo_url: url }).eq("user_id", user.id);
      if (updErr) throw updErr;
      setProfile({ ...profile, photo_url: url });
      toast.success("Photo updated!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    }
    setUploadingPhoto(false);
  };

  const changePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { toast.error("Fill all password fields"); return; }
    if (newPwd.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (!/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      toast.error("Password must include uppercase, lowercase, and a number"); return;
    }
    if (newPwd !== confirmPwd) { toast.error("Passwords don't match"); return; }
    if (!user?.email) { toast.error("No email on account"); return; }

    setChangingPwd(true);
    // Verify current password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd });
    if (signInErr) {
      toast.error("Current password is incorrect");
      setChangingPwd(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) toast.error("Update failed: " + error.message);
    else {
      toast.success("Password changed");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    }
    setChangingPwd(false);
  };

  const deleteAccount = async () => {
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
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-foreground">My Profile</h1>

      {/* Profile Card */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 bg-primary text-primary-foreground">
              {profile?.photo_url && <AvatarImage src={profile.photo_url} alt={userName} />}
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90 transition-colors" aria-label="Upload profile photo">
              <Upload className="h-3 w-3" />
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">{userName}</h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="gap-1">
                <RoleIcon className="h-3 w-3" /> {roleLabel}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 bg-success/10 text-success border-success/30">
                <div className="w-1.5 h-1.5 rounded-full bg-success" /> Online
              </Badge>
            </div>
          </div>
        </div>
        {uploadingPhoto && <p className="text-xs text-muted-foreground">Uploading photo...</p>}
      </div>

      {/* Hotel Info */}
      <div className="glass-card p-4 flex items-center gap-3">
        <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Currently working at</p>
          <p className="text-sm font-semibold text-foreground truncate">{hotelName}</p>
        </div>
      </div>

      {/* Details */}
      <div className="glass-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>

        {/* Phone */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Phone</p>
          {editPhone ? (
            <div className="flex items-center gap-2">
              <Input
                type="tel"
                value={phoneVal}
                onChange={(e) => setPhoneVal(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="h-9"
              />
              <Button size="icon" variant="default" className="h-9 w-9" onClick={savePhone} disabled={savingPhone} aria-label="Save phone">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditPhone(false); setPhoneVal(profile?.phone || ""); }} aria-label="Cancel">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground">{profile?.phone || "Not set"}</p>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditPhone(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          )}
        </div>

        {/* Address */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Address</p>
          {editAddress ? (
            <div className="flex items-center gap-2">
              <Input
                value={addressVal}
                onChange={(e) => setAddressVal(e.target.value)}
                placeholder="e.g. 123 Main Street, Pune"
                className="h-9"
              />
              <Button size="icon" variant="default" className="h-9 w-9" onClick={saveAddress} disabled={savingAddress} aria-label="Save address">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditAddress(false); setAddressVal(profile?.address || ""); }} aria-label="Cancel">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground truncate">{profile?.address || "Not set"}</p>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditAddress(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-sm text-foreground">{joinDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Account Created</p>
            <p className="text-sm text-foreground">{accountCreated}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm text-foreground">{profile?.is_active ? "Active" : "Inactive"}</p>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Daily Performance
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.ordersToday}</p>
            <p className="text-xs text-muted-foreground">{role === "chef" ? "Prepared Today" : "Orders Today"}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
              <IndianRupee className="h-5 w-5" />{Math.round(stats.revenueToday).toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground">Revenue Today</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
              <Users className="h-5 w-5" />{stats.tablesServedToday}
            </p>
            <p className="text-xs text-muted-foreground">Tables Served Today</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Total All Time</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Change Password
        </h3>
        <div className="space-y-2">
          <Input type="password" placeholder="Current password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} autoComplete="current-password" />
          <Input type="password" placeholder="New password (min 8 chars, A-Z, a-z, 0-9)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" />
          <Input type="password" placeholder="Confirm new password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
          <Button onClick={changePassword} disabled={changingPwd} className="w-full">
            {changingPwd ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full glass-card p-3 flex items-center gap-3 text-sm text-foreground hover:bg-secondary/60 transition-colors rounded-xl"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </button>
        <Button variant="destructive" className="w-full gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-4 space-y-2 border-2 border-destructive/30">
        <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">Delete My Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all associated data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deleteAccount}
              >
                Yes, delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default StaffProfile;
