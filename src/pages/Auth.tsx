import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, ChefHat, BarChart3, Grid3X3, UtensilsCrossed, ScrollText, ShieldCheck, ShieldAlert } from "lucide-react";
import { getScopedStorageKey } from "@/lib/backend-cache";
import { Progress } from "@/components/ui/progress";

type AuthMode = "login" | "signup";
type RoleChoice = "owner" | "waiter" | "chef";

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
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleChoice>("owner");
  const [hotelCode, setHotelCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async () => {
    const normalizedHotelCode = hotelCode.trim().toUpperCase();

    if (!email || !password || !fullName) { toast.error("Fill all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (role !== "owner" && !normalizedHotelCode) { toast.error("Hotel code is required for staff accounts"); return; }
    if (role !== "owner" && !/^QB-\d{4}$/.test(normalizedHotelCode)) { toast.error("Enter a valid hotel code like QB-1234"); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), role, hotel_code: role === "owner" ? null : normalizedHotelCode },
        emailRedirectTo: window.location.origin,
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
      redirectTo: `${window.location.origin}/reset-password`,
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
    <div className="min-h-screen flex bg-background">
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

          {forgotMode ? (
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
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    mode === "login" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMode("login")}
                >Login</button>
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    mode === "signup" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMode("signup")}
                >Sign Up</button>
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

                {mode === "login" && (
                  <button className="text-sm text-primary w-full text-center hover:underline font-medium" onClick={() => setForgotMode(true)}>
                    Forgot Password?
                  </button>
                )}
              </div>

              <div className="text-center space-y-3 pt-2">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                  <span>•</span>
                  <a href="/terms" className="text-primary hover:underline">Terms & Conditions</a>
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
