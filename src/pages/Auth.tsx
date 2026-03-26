import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, ArrowRight, Building2, ChefHat, ConciergeBell } from "lucide-react";

type AuthMode = "login" | "signup";
type RoleChoice = "owner" | "waiter" | "chef";

const roleInfo: Record<RoleChoice, { icon: any; label: string; desc: string }> = {
  owner: { icon: Building2, label: "Owner", desc: "Full access" },
  waiter: { icon: ConciergeBell, label: "Waiter", desc: "Orders & tables" },
  chef: { icon: ChefHat, label: "Chef", desc: "Kitchen display" },
};

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

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Enter email and password"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) { toast.error("Fill all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      if (role === "waiter" && hotelCode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: linkError } = await supabase.rpc("link_waiter_to_hotel", {
            _user_id: user.id,
            _hotel_code: hotelCode,
          });
          if (linkError) toast.error("Could not link to hotel: " + linkError.message);
        }
      }
      toast.success("Account created! You can now sign in.");
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

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(240 33% 10%) 0%, hsl(240 33% 14%) 50%, hsl(222 39% 16%) 100%)" }} />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #F97316, transparent 70%)" }} />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #F97316, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10 animate-pop-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl gradient-btn-primary flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold gradient-text-orange tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SpeedoBill</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Restaurant Management System</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 md:p-8 space-y-5">
          {forgotMode ? (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-foreground">Reset Password</h2>
                <p className="text-sm text-muted-foreground">We'll send you a reset link</p>
              </div>
              <Input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-secondary/50 border-border" />
              <Button className="w-full h-12 gradient-btn-primary text-base" onClick={handleForgotPassword} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <button className="text-sm text-primary w-full text-center hover:underline" onClick={() => setForgotMode(false)}>
                ← Back to login
              </button>
            </>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex rounded-xl bg-secondary/50 p-1 gap-1">
                <button
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "login" ? "gradient-btn-primary shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setMode("login")}
                >Sign In</button>
                <button
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "signup" ? "gradient-btn-primary shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setMode("signup")}
                >Sign Up</button>
              </div>

              <div className="space-y-4">
                {mode === "signup" && (
                  <>
                    <Input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} className="h-12 bg-secondary/50 border-border" />
                    <div className="space-y-2">
                      <label className="label-caps text-xs">Select your role</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["owner", "waiter", "chef"] as RoleChoice[]).map(r => {
                          const info = roleInfo[r];
                          return (
                            <button
                              key={r}
                              onClick={() => setRole(r)}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                                role === r ? "border-primary bg-primary/10 shadow-md" : "border-border bg-secondary/30 hover:border-muted-foreground/30"
                              }`}
                            >
                              <info.icon className={`h-5 w-5 ${role === r ? "text-primary" : "text-muted-foreground"}`} />
                              <span className={`text-xs font-semibold ${role === r ? "text-primary" : "text-muted-foreground"}`}>{info.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {role === "waiter" && (
                      <Input placeholder="Hotel Code (e.g. QB-1234)" value={hotelCode} onChange={e => setHotelCode(e.target.value)} className="h-12 bg-secondary/50 border-border" />
                    )}
                  </>
                )}

                <Input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-secondary/50 border-border" />
                <div className="relative">
                  <Input
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignup())}
                    className="h-12 bg-secondary/50 border-border pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {mode === "login" && (
                  <button className="text-sm text-primary hover:underline" onClick={() => setForgotMode(true)}>
                    Forgot password?
                  </button>
                )}

                <Button className="w-full h-12 gradient-btn-primary text-base group" onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading}>
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      {mode === "login" ? "Sign In" : "Create Account"}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-[11px] text-center text-muted-foreground">
                By continuing, you agree to our{" "}
                <a href="/terms" className="text-primary hover:underline">Terms</a> &{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
