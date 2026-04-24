/**
 * Mounts once authenticated. Initializes OneSignal and binds the current
 * Supabase user (external_id) + their hotel to OneSignal so the secure
 * `send-push` edge function can target them by hotel scope.
 *
 * Also wires foreground push events to the global audio bell so users
 * hear the configured `kitchen_bell.mp3` when the tab is active.
 */
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { initOneSignal, loginOneSignalUser, logoutOneSignalUser } from "@/lib/onesignal";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";

export default function OneSignalBootstrap() {
  const { user, hotelId } = useAuth();
  const { playBell } = useAudioNotification();

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

  // Hook into OneSignal foreground events to play the in-app bell.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const handler = (OneSignal: any) => {
      try {
        OneSignal.Notifications?.addEventListener?.("foregroundWillDisplay", () => {
          void playBell();
        });
      } catch {}
    };
    window.OneSignalDeferred.push(handler);
  }, [playBell]);

  return null;
}

