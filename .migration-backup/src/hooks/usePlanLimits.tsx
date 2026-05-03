import { useMemo, useState, useCallback } from "react";
import { useSubscription } from "@/hooks/useSubscription";

export type PlanTier = "free" | "basic" | "premium";

export interface PlanLimits {
  tables: number;
  menuItems: number;
  staff: number;
  aiScanner: boolean;
  dataExport: boolean;
  advancedAnalytics: boolean;
  inventory: boolean;
  customers: boolean;
  whatsappBilling: boolean;
  removeBranding: boolean;
}

const LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    tables: 5,
    menuItems: 20,
    staff: 1,
    aiScanner: false,
    dataExport: false,
    advancedAnalytics: false,
    inventory: false,
    customers: false,
    whatsappBilling: false,
    removeBranding: false,
  },
  basic: {
    tables: 20,
    menuItems: Infinity,
    staff: 5,
    aiScanner: true,
    dataExport: true,
    advancedAnalytics: false,
    inventory: false,
    customers: false,
    whatsappBilling: false,
    removeBranding: true,
  },
  premium: {
    tables: Infinity,
    menuItems: Infinity,
    staff: Infinity,
    aiScanner: true,
    dataExport: true,
    advancedAnalytics: true,
    inventory: true,
    customers: true,
    whatsappBilling: true,
    removeBranding: true,
  },
};

const normalizeTier = (plan: string | null, status: string): PlanTier => {
  if (status === "trial") return "premium"; // trial gets full premium access
  const p = (plan ?? "").toLowerCase();
  if (p.includes("premium")) return "premium";
  if (p.includes("basic")) return "basic";
  return "free";
};

export function usePlanTier(): PlanTier {
  const { plan, status } = useSubscription();
  return useMemo(() => normalizeTier(plan, status), [plan, status]);
}

export function usePlanLimits(): PlanLimits {
  const tier = usePlanTier();
  return LIMITS[tier];
}

/**
 * Centralized upgrade-prompt state. Use one instance per page.
 * Returns the dialog props and a `gate` function that checks a condition
 * and triggers the upgrade prompt if the user can't proceed.
 */
export function useUpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [featureName, setFeatureName] = useState("This feature");
  const [requiredPlan, setRequiredPlan] = useState<"Basic" | "Premium">("Basic");

  const promptUpgrade = useCallback(
    (feature: string, plan: "Basic" | "Premium" = "Basic") => {
      setFeatureName(feature);
      setRequiredPlan(plan);
      setOpen(true);
    },
    [],
  );

  return {
    upgradeDialogProps: { open, onOpenChange: setOpen, featureName, requiredPlan },
    promptUpgrade,
  };
}
