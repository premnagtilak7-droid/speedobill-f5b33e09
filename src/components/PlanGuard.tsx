import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface PlanGuardProps {
  children: ReactNode;
  featureName?: string;
}

/**
 * Wraps premium features. If user is on FREE plan, shows a blur overlay
 * with an "Upgrade to Premium" CTA instead of the content.
 */
const PlanGuard = ({ children, featureName = "This feature" }: PlanGuardProps) => {
  const { status, loading } = useSubscription();
  const navigate = useNavigate();
  const hasAccess = status === "active" || status === "trial";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred background content placeholder */}
      <div className="pointer-events-none select-none filter blur-md opacity-40 overflow-hidden max-h-[70vh]">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm z-10">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border shadow-xl max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Premium Feature</h2>
          <p className="text-sm text-muted-foreground">
            {featureName} is available on the Premium plan. Upgrade now to unlock all features.
          </p>
          <Button size="lg" className="w-full" onClick={() => navigate("/pricing")}>
            Upgrade to Premium
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanGuard;
