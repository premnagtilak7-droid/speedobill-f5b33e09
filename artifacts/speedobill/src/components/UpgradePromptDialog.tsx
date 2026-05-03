import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  requiredPlan?: "Basic" | "Premium";
  priceLine?: string;
}

const UpgradePromptDialog = ({
  open,
  onOpenChange,
  featureName,
  requiredPlan = "Basic",
  priceLine,
}: UpgradePromptDialogProps) => {
  const navigate = useNavigate();
  const price = priceLine ?? (requiredPlan === "Premium" ? "₹499/month" : "₹199/month");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            🔒 {requiredPlan} plan required
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            <span className="font-semibold text-foreground">{featureName}</span> is available on the {requiredPlan} plan.
            <br />
            <span className="mt-2 inline-block">Upgrade for just <span className="font-bold text-primary">{price}</span>!</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button
            className="w-full sm:w-auto gradient-btn-primary"
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePromptDialog;
