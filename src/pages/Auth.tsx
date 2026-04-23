import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { Eye, EyeOff, Zap, ChefHat, BarChart3, Grid3X3, UtensilsCrossed, ScrollText, ShieldCheck, ShieldAlert, KeyRound, ArrowLeft, Delete, User } from "lucide-react";
import { getScopedStorageKey } from "@/lib/backend-cache";
import { getAuthRedirectOrigin, getResetPasswordRedirectUrl } from "@/lib/platform";
import { Progress } from "@/components/ui/progress";

type AuthMode = "login" | "signup";
type RoleChoice = "owner" | "waiter" | "chef";
type StaffStep = "code" | "select" | "pin";
interface StaffOption { user_id: string; full_name: string; role: string; }

const slides = [
  {
    icon: UtensilsCrossed,
    title: "Smart Menu Management",
    desc: "Add, edit, and organize your menu items with categories, pricing variants, and AI-powered scanning.",
  },
  {
    icon: ChefHat,
    title: "Live Kitchen Display",
    desc: "Orders appear in real-time on your kitchen screen. Zero delays.",
  },
  {
    icon: Grid3X3,
    title: "Table Management",
    desc: "Visual floor plan with real-time status updates. Track every table at a glance.",
  },
  {
    icon: BarChart3,
    title: "Powerful Analytics",
    desc: "Daily sales, revenue trends, staff performance and inventory insights.",
  },
  {
    icon: ScrollText,
    title: "Instant Billing",
    desc: "Generate GST bills in seconds. Share via WhatsApp or print thermal receipts.",
  },
];

const getStaffHotelCodeCacheKey = (email: string) =>
  getScopedStorageKey(`qb_staff_hotel_code:${email.trim().toLowerCase()}`);

const cacheStaffHotelCode = (email: string, hotelCode: string) => {
  if (!email.trim() || !hotelCode.trim()) return;

  try {
    localStorage.setItem(getStaffHotelCodeCacheKey(email), hotelCode.trim().toUpperCase());
  } catch {}
};

const readCachedHotelCode = (email: string) => {
  if (!email.trim()) return "";

  try {
    return localStorage.getItem(getStaffHotelCodeCacheKey(email)) ?? "";
  } catch {
    return "";
  }
};

const COMMON_PASSWORDS = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty123", "password1",
  "iloveyou", "admin123", "welcome1", "monkey123", "dragon12", "master12",
  "letmein1", "abc12345", "football1", "shadow12", "sunshine1", "trustno1",
  "princess1", "baseball1",
]);

interface PasswordStrength {
  score: number; // 0-100
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
}

function evaluatePassword(pw: string): PasswordStrength {
  const checks = [
    { label: "8+ characters", passed: pw.length >= 8 },
    { label: "Uppercase letter", passed: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", passed: /[a-z]/.test(pw) },
    { label: "Number", passed: /\d/.test(pw) },
    { label: "Special character (!@#$…)", passed: /[^A-Za-z0-9]/.test(pw) },
    { label: "Not a common password", passed: !COMMON_PASSWORDS.has(pw.toLowerCase()) },
  ];
  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const label = score <= 33 ? "Weak" : score <= 66 ? "Fair" : score < 100 ? "Good" : "Strong";
  const color =
    score <= 33 ? "bg-destructive" : score <= 66 ? "bg-yellow-500" : score < 100 ? "bg-blue-500" : "bg-green-500";
  return { score, label, color, checks };
}

const Auth = () => {
  const location = useLocation();
  const isStaffRoute = location.pathname.startsWith("/auth/staff");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleChoice>("owner");
  const [hotelCode, setHotelCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  // Staff PIN login state
  const [staffMode, setStaffMode] = useState(isStaffRoute);
  const [staffStep, setStaffStep] = useState<StaffStep>("code");
  const [staffHotelCode, setStaffHotelCode] = useState("");
  const [staffHotelId, setStaffHotelId] = useState<string | null>(null);
  const [staffHotelName, setStaffHotelName] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [pinDigits, setPinDigits] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectOrigin() },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const resetStaffFlow = () => {
    setStaffMode(false);
    setStaffStep("code");
    setStaffHotelCode("");
    setStaffHotelId(null);
    setStaffHotelName("");
    setStaffOptions([]);
    setSelectedStaff(null);
    setPinDigits("");
  };

  const handleStaffFetch = async () => {
    const code = staffHotelCode.trim().toUpperCase();
    if (!/^\d{6}$/.test(code) && !/^QB-\d{4}$/.test(code)) {
      toast.error("Enter a valid hotel code (6 digits)");
      return;
    }
    setStaffLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-list-by-code", {
        body: { hotel_code: code },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const staff: StaffOption[] = (data as any)?.staff ?? [];
      if (!staff.length) {
        toast.error("No active staff with PINs found for this hotel");
        return;
      }
      setStaffHotelId((data as any).hotel_id);
      setStaffHotelName((data as any).hotel_name || "");
      setStaffOptions(staff);
      setStaffStep("select");
    } catch (err: any) {
      toast.error(err?.message || "Could not load staff");
    } finally {
      setStaffLoading(false);
    }
  };

  const handlePinDigit = (d: string) => {
    setPinDigits((prev) => (prev.length >= 4 ? prev : prev + d));
  };
  const handlePinBackspace = () => setPinDigits((prev) => prev.slice(0, -1));
  const handlePinClear = () => setPinDigits("");

  const handleStaffPinSubmit = async (pinValue: string) => {
    if (!selectedStaff || !staffHotelCode || pinValue.length !== 4) return;
    setStaffLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-staff-pin", {
        body: {
          hotel_code: staffHotelCode.trim().toUpperCase(),
          user_id: selectedStaff.user_id,
          pin: pinValue,
        },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.token_hash) throw new Error("Login failed. Please try again.");

      // Exchange the magic link token for a session
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: payload.token_hash,
      });
      if (verifyErr) throw verifyErr;

      cacheStaffHotelCode(payload.email || `${selectedStaff.user_id}@staff`, staffHotelCode.trim().toUpperCase());
      toast.success(`Welcome, ${selectedStaff.full_name}!`);

      // Redirect by role — page will route based on auth state, but force navigation for clarity
      const target = selectedStaff.role === "chef" ? "/kds" : "/tables";
      window.location.replace(target);
    } catch (err: any) {
      toast.error(err?.message || "Could not verify PIN");
      setPinDigits("");
    } finally {
      setStaffLoading(false);
    }
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (staffStep === "pin" && pinDigits.length === 4 && !staffLoading) {
      void handleStaffPinSubmit(pinDigits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinDigits, staffStep]);


  const pwStrength = useMemo(() => evaluatePassword(password), [password]);
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode !== "login" || !email.trim()) return;

    const cachedCode = readCachedHotelCode(email);
    if (cachedCode) {
      setHotelCode(cachedCode);
    }
  }, [mode, email]);

  const handleLogin = async () => {
    const normalizedHotelCode = hotelCode.trim().toUpperCase();

    if (!email || !password) { toast.error("Enter email and password"); return; }
    if (normalizedHotelCode) cacheStaffHotelCode(email, normalizedHotelCode);

    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else if (data.user) {
      // Audit: staff login (best-effort; hotel_id may be unknown until profile loads)
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("hotel_id, full_name, role")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (prof?.hotel_id) {
          void writeAudit({
            hotelId: prof.hotel_id,
            action: "staff_login",
            performedBy: data.user.id,
            performerName: prof.full_name || data.user.email || null,
            details: `${prof.role || "Staff"} logged in`,
          });
        }
      } catch { /* swallow */ }
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    const normalizedHotelCode = hotelCode.trim().toUpperCase();

    if (!email || !password || !fullName) { toast.error("Fill all fields"); return; }
    if (pwStrength.score < 100) {
      const missing = pwStrength.checks.filter(c => !c.passed).map(c => c.label).join(", ");
      toast.error(`Password too weak. Missing: ${missing}`);
      return;
    }
    if (role !== "owner" && !normalizedHotelCode) { toast.error("Hotel code is required for staff accounts"); return; }
    if (role !== "owner" && !/^QB-\d{4}$/.test(normalizedHotelCode)) { toast.error("Enter a valid hotel code like QB-1234"); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), role, hotel_code: role === "owner" ? null : normalizedHotelCode },
        emailRedirectTo: getAuthRedirectOrigin(),
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      if (role !== "owner" && normalizedHotelCode) {
        cacheStaffHotelCode(email, normalizedHotelCode);
      }

      if (role !== "owner" && normalizedHotelCode && data.user) {
        try {
          const { error: linkError } = await supabase.rpc("link_waiter_to_hotel", {
            _user_id: data.user.id,
            _hotel_code: normalizedHotelCode,
          });
          if (linkError) toast.warning("Account created. Hotel link will complete after first login.");
        } catch {
          toast.warning("Account created. Hotel link will complete after first login.");
        }
      }
      toast.success(role === "owner" ? "Owner account created with a 7-day free trial." : "Staff account created. You can now sign in.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { toast.error("Enter your email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordRedirectUrl(),
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent!");
    setLoading(false);
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success("Cache cleared! Reloading...");
    setTimeout(() => window.location.reload(), 800);
  };

  const currentSlide = slides[activeSlide];

  return (
    <div className="min-h-screen flex bg-background relative">
      {/* Desktop-only "Back to Website" — only on /auth page */}
      <a
        href="/"
        aria-label="Back to website"
        className="hidden md:inline-flex absolute top-4 left-4 z-20 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-orange-500"
      >
        <span aria-hidden>←</span>
        Back to Website
      </a>
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative items-center justify-center overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #F97316, transparent 70%)" }} />
        <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #F97316, transparent 70%)" }} />

        <div className="relative z-10 max-w-md px-8 text-center space-y-8">
          <div className="mx-auto w-28 h-28 rounded-3xl bg-card border border-border flex items-center justify-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl gradient-btn-primary flex items-center justify-center">
              <Zap className="h-8 w-8 text-white" />
            </div>
          </div>

          <div className="space-y-3 min-h-[120px]" key={activeSlide}>
            <div className="animate-pop-in">
              <h2 className="text-2xl font-bold text-foreground">{currentSlide.title}</h2>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{currentSlide.desc}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === activeSlide ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 md:border-l md:border-border relative">
        <div className="w-full max-w-sm space-y-6 animate-pop-in">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold gradient-text-orange" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              SpeedoBill
            </h1>
            <p className="text-sm text-muted-foreground">Smart Restaurant Management</p>
          </div>

          {staffMode ? (
            <div className="space-y-5">
              <button
                onClick={resetStaffFlow}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Owner Login
              </button>

              {staffStep === "code" && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <KeyRound className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Staff Login</h2>
                    <p className="text-xs text-muted-foreground">Enter your hotel's 6-digit code to continue</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground">Hotel Code</label>
                    <Input
                      placeholder="e.g. 384172"
                      value={staffHotelCode}
                      onChange={(e) => setStaffHotelCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleStaffFetch()}
                      inputMode="numeric"
                      maxLength={9}
                      className="h-12 bg-secondary/50 border-border text-center text-lg tracking-[0.4em] font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Ask your owner for the hotel code shown on their dashboard.</p>
                  </div>
                  <Button
                    className="w-full h-12 gradient-btn-primary text-base font-semibold rounded-xl"
                    onClick={handleStaffFetch}
                    disabled={staffLoading || !staffHotelCode.trim()}
                  >
                    {staffLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : "Continue"}
                  </Button>
                </div>
              )}

              {staffStep === "select" && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-foreground">Select your name</h2>
                    {staffHotelName && (
                      <p className="text-xs text-muted-foreground">{staffHotelName} • {staffHotelCode}</p>
                    )}
                  </div>
                  <div className="grid gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {staffOptions.map((s) => (
                      <button
                        key={s.user_id}
                        onClick={() => {
                          setSelectedStaff(s);
                          setPinDigits("");
                          setStaffStep("pin");
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary hover:border-primary transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">›</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setStaffStep("code"); setStaffOptions([]); }}
                    className="text-sm text-primary w-full text-center hover:underline"
                  >
                    ← Use a different hotel code
                  </button>
                </div>
              )}

              {staffStep === "pin" && selectedStaff && (
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{selectedStaff.full_name}</h2>
                    <p className="text-xs text-muted-foreground capitalize">{selectedStaff.role} • Enter your 4-digit PIN</p>
                  </div>

                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                          pinDigits.length > i
                            ? "bg-primary/10 border-primary text-foreground"
                            : "bg-secondary/40 border-border text-muted-foreground"
                        }`}
                      >
                        {pinDigits.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={staffLoading || pinDigits.length >= 4}
                        onClick={() => handlePinDigit(d)}
                        className="h-14 rounded-xl bg-secondary/50 border border-border text-xl font-bold text-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={staffLoading}
                      onClick={handlePinClear}
                      className="h-14 rounded-xl bg-secondary/30 border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={staffLoading || pinDigits.length >= 4}
                      onClick={() => handlePinDigit("0")}
                      className="h-14 rounded-xl bg-secondary/50 border border-border text-xl font-bold text-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={staffLoading || pinDigits.length === 0}
                      onClick={handlePinBackspace}
                      className="h-14 rounded-xl bg-secondary/30 border border-border flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
                      aria-label="Backspace"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  </div>

                  {staffLoading && (
                    <div className="flex justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}

                  <button
                    onClick={() => { setStaffStep("select"); setPinDigits(""); setSelectedStaff(null); }}
                    className="text-sm text-primary w-full text-center hover:underline"
                  >
                    ← Choose a different name
                  </button>
                </div>
              )}
            </div>
          ) : forgotMode ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <Input placeholder="you@hotel.com" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 bg-secondary/50 border-border" />
              </div>
              <Button className="w-full h-11 gradient-btn-primary" onClick={handleForgotPassword} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <button className="text-sm text-primary w-full text-center hover:underline" onClick={() => setForgotMode(false)}>
                ← Back to Login
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-xs font-semibold text-foreground">Sign in to your account</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  New to SpeedoBill?{" "}
                  <a href="/#request-access" className="font-semibold text-primary hover:underline">
                    Request Access
                  </a>
                </p>
              </div>

              <div className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground">Full Name</label>
                    <Input placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="h-11 bg-secondary/50 border-border" />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-bold text-foreground">Email Address</label>
                  <Input placeholder="you@hotel.com" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 bg-secondary/50 border-border" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-foreground">Password</label>
                  <div className="relative">
                    <Input
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignup())}
                      className="h-11 bg-secondary/50 border-border pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && password.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <div className="flex items-center gap-2">
                        <Progress value={pwStrength.score} className={`h-2 flex-1 [&>div]:${pwStrength.color}`} />
                        <span className={`text-xs font-semibold ${pwStrength.score <= 33 ? "text-destructive" : pwStrength.score <= 66 ? "text-yellow-500" : pwStrength.score < 100 ? "text-blue-500" : "text-green-500"}`}>
                          {pwStrength.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        {pwStrength.checks.map((c) => (
                          <span key={c.label} className={`text-[11px] flex items-center gap-1 ${c.passed ? "text-green-500" : "text-muted-foreground"}`}>
                            {c.passed ? "✓" : "○"} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {mode === "login" && (
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground">Hotel Code <span className="text-xs font-normal text-muted-foreground">(required for staff)</span></label>
                    <Input
                      placeholder="e.g. QB-1234"
                      value={hotelCode}
                      onChange={e => setHotelCode(e.target.value.toUpperCase())}
                      className="h-11 bg-secondary/50 border-border"
                    />
                    <p className="text-xs text-muted-foreground">Owners leave blank. Waiters, chefs & managers must enter their hotel code.</p>
                  </div>
                )}

                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-primary">I am a...</label>
                      <div className="flex gap-2">
                        {([
                          { key: "owner" as RoleChoice, icon: "👑", label: "Owner" },
                          { key: "waiter" as RoleChoice, icon: "🍽️", label: "Waiter" },
                          { key: "chef" as RoleChoice, icon: "👨‍🍳", label: "Chef" },
                        ]).map(r => (
                          <button
                            key={r.key}
                            onClick={() => setRole(r.key)}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                              role === r.key
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            <span>{r.icon}</span> {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(role === "waiter" || role === "chef") && (
                      <div className="space-y-1">
                        <label className="text-sm font-bold text-foreground">Hotel Code</label>
                        <Input placeholder="e.g. QB-1234" value={hotelCode} onChange={e => setHotelCode(e.target.value.toUpperCase())} className="h-11 bg-secondary/50 border-border" />
                        <p className="text-xs text-muted-foreground">Waiter and chef accounts need a valid owner hotel code before they can open the app.</p>
                      </div>
                    )}
                  </>
                )}

                <Button className="w-full h-12 gradient-btn-primary text-base font-semibold rounded-xl" onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading || (mode === "signup" && role !== "owner" && !hotelCode.trim())}>
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    mode === "login" ? "Sign In" : "Create Account"
                  )}
                </Button>

                {/* Google OAuth */}
                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full h-12 rounded-xl border border-border bg-white flex items-center justify-center gap-3 text-sm font-medium text-[#1f1f1f] hover:bg-[#f7f8f8] transition-colors disabled:opacity-50 shadow-sm"
                  style={{ fontFamily: "'Google Sans', 'Roboto', Arial, sans-serif" }}
                >
                  {googleLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {mode === "login" && (
                  <button className="text-sm text-primary w-full text-center hover:underline font-medium" onClick={() => setForgotMode(true)}>
                    Forgot Password?
                  </button>
                )}

                {mode === "login" && (
                  <div className="pt-2">
                    <div className="relative flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">Staff member?</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 rounded-xl mt-2 gap-2 font-semibold"
                      onClick={() => {
                        setStaffMode(true);
                        setStaffStep("code");
                        setPinDigits("");
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                      Staff Login (Hotel Code + PIN)
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center space-y-3 pt-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground px-4">
                  By signing in you agree to our{" "}
                  <a href="/terms" className="text-primary hover:underline">Terms</a>
                  {" "}&{" "}
                  <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <a href="/privacy" className="text-primary hover:underline">Privacy</a>
                  <span>•</span>
                  <a href="/terms" className="text-primary hover:underline">Terms</a>
                  <span>•</span>
                  <a href="/support" className="text-primary hover:underline">Support</a>
                </div>
                <button
                  onClick={handleClearCache}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto"
                >
                  🔄 Reset App (Clear Cache)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
