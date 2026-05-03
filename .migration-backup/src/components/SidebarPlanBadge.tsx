import { Crown, Sparkles, Clock } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

interface Props {
  collapsed?: boolean;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return null;
  }
};

const SidebarPlanBadge = ({ collapsed }: Props) => {
  const { status, plan, expiresAt, daysLeft } = useSubscription();
  const navigate = useNavigate();

  if (status === "free") {
    return (
      <button
        onClick={() => navigate("/pricing")}
        className={`w-full mt-2 rounded-xl border border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.12] transition-colors px-3 py-2.5 text-left ${
          collapsed ? "flex items-center justify-center" : ""
        }`}
        title="Upgrade plan"
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        {!collapsed && (
          <span className="ml-2 inline-block">
            <span className="block text-[11px] font-bold text-primary leading-tight">Upgrade plan</span>
            <span className="block text-[10px] text-muted-foreground leading-tight">Unlock everything</span>
          </span>
        )}
      </button>
    );
  }

  const isTrial = status === "trial";
  const planLabel = isTrial
    ? "Free Trial"
    : plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "Active";
  const expiry = formatDate(expiresAt);
  const accent = isTrial
    ? "from-amber-500/30 to-amber-500/[0.05] border-amber-500/30 text-amber-500"
    : plan === "premium"
    ? "from-violet-500/30 to-violet-500/[0.05] border-violet-500/30 text-violet-400"
    : "from-primary/30 to-primary/[0.05] border-primary/30 text-primary";

  return (
    <button
      onClick={() => navigate(plan === "premium" ? "/billing-history" : "/pricing")}
      className={`w-full mt-2 rounded-xl border bg-gradient-to-br ${accent} px-3 py-2.5 text-left hover:brightness-110 transition ${
        collapsed ? "flex items-center justify-center" : ""
      }`}
      title={`${planLabel}${expiry ? ` · expires ${expiry}` : ""}`}
    >
      {isTrial ? <Clock className="h-4 w-4 shrink-0" /> : <Crown className="h-4 w-4 shrink-0" />}
      {!collapsed && (
        <span className="ml-2 inline-block">
          <span className="block text-[11px] font-bold leading-tight">{planLabel}</span>
          <span className="block text-[10px] text-muted-foreground leading-tight">
            {isTrial && daysLeft !== null
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
              : expiry
              ? `Renews ${expiry}`
              : "Active"}
          </span>
        </span>
      )}
    </button>
  );
};

export default SidebarPlanBadge;
