/**
 * KioskLockGuard
 *
 * When Kiosk Mode is active and a STAFF user is logged in (chef/waiter/manager),
 * this guard locks the user to their single primary screen. Any attempt to
 * navigate elsewhere is redirected back.
 *
 * Owner-while-kiosk-active is handled separately (we render <StaffKiosk />
 * before they ever land here).
 */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useKioskMode } from "@/hooks/useKioskMode";

const ALLOWED_PATHS_BY_ROLE: Record<string, string> = {
  chef: "/kds",
  waiter: "/tables",
  manager: "/dashboard",
};

export const KioskLockGuard = () => {
  const { isKiosk } = useKioskMode();
  const { role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isKiosk || !role) return;
    if (role === "owner") return; // Owner sees the StaffKiosk overlay instead

    const allowed = ALLOWED_PATHS_BY_ROLE[role];
    if (!allowed) return;

    if (location.pathname !== allowed) {
      navigate(allowed, { replace: true });
    }
  }, [isKiosk, role, location.pathname, navigate]);

  return null;
};

export default KioskLockGuard;
