import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { playWarningTone } from "@/lib/notification-sounds";

const DISMISS_KEY = "qb_expired_banner_dismissed";

const SubscriptionExpiredBanner = () => {
  const { status } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal whenever status flips back to expired in a fresh session
  useEffect(() => {
    if (status !== "expired") return;
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      setDismissed(stored === "1");
    } catch {
      setDismissed(false);
    }
  }, [status]);

  // Play alert sound once per session when first showing
  useEffect(() => {
    if (status !== "expired" || dismissed) return;
    try {
      const playedKey = "qb_expired_sound_played";
      if (sessionStorage.getItem(playedKey) !== "1") {
        playWarningTone();
        sessionStorage.setItem(playedKey, "1");
      }
    } catch {
      // ignore
    }
  }, [status, dismissed]);

  if (status !== "expired" || dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="sticky top-0 z-40 w-full border-b border-destructive/40 bg-destructive/10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">⚠️ Your subscription has expired</p>
            <p className="text-muted-foreground">
              Your account is now on the Free plan. Some features are limited. Renew to restore full access.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            className="border-border/60"
          >
            Continue on Free
          </Button>
          <Button
            size="sm"
            className="gradient-btn-primary"
            onClick={() => navigate("/pricing")}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Renew Now
          </Button>
          <button
            aria-label="Dismiss"
            onClick={handleDismiss}
            className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpiredBanner;
