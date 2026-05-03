import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/auth-bootstrap";

interface RoleGuardProps {
  allowed: AppRole[];
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Blocks access to routes unless the user's role is in the allowed list.
 * Waiters → /tables, Chefs → /kds, otherwise /dashboard.
 */
const RoleGuard = ({ allowed, children, redirectTo }: RoleGuardProps) => {
  const { role, loading } = useAuth();

  // Wait for role to resolve before deciding access
  if (loading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!allowed.includes(role)) {
    const fallback =
      redirectTo ||
      (role === "waiter" ? "/tables" : role === "chef" ? "/kds" : role === "manager" || role === "owner" ? "/dashboard" : "/tables");
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
