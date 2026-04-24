/**
 * Mounts once authenticated. Initializes OneSignal and binds the current
 * Supabase user (external_id) + their hotel to OneSignal so the secure
 * `send-push` edge function can target them by hotel scope.
 */
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { initOneSignal, loginOneSignalUser, logoutOneSignalUser } from "@/lib/onesignal";

export default function OneSignalBootstrap() {
  const { user, hotelId } = useAuth();

  useEffect(() => {
    initOneSignal().catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.id && hotelId) {
      loginOneSignalUser(user.id, hotelId).catch(() => {});
    } else if (!user) {
      logoutOneSignalUser().catch(() => {});
    }
  }, [user?.id, hotelId]);

  return null;
}
