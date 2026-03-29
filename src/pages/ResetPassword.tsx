import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check URL hash for recovery type
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    // Listen for auth state change with recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/auth");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Key className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            {isRecovery ? "Enter your new password below." : "Use the link from your email to reset your password."}
          </p>
        </div>
        {isRecovery ? (
          <div className="space-y-4">
            <Input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} className="h-11" />
            <Input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} className="h-11" />
            <Button className="w-full h-11" onClick={handleReset} disabled={loading}>
              {loading ? "Updating..." : "Set New Password"}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Check your email for a password reset link. Click it and you'll be redirected here.</p>
            <Button variant="outline" onClick={() => navigate("/auth")}>Back to Login</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
