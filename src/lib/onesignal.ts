/**
 * OneSignal browser-SDK wrapper.
 *
 * Public App ID is safe to ship to the frontend. The REST API Key is NEVER
 * referenced here — push sends are handled by the `send-push` edge function
 * which reads the secret from Supabase secrets.
 *
 * We tie each subscription to the Supabase user via `external_id` so the
 * edge function can target users by their Supabase UID, scoped to a hotel.
 */
import { supabase } from "@/integrations/supabase/client";

export const ONESIGNAL_APP_ID = "2dd083f3-b114-4d3d-82d6-1d743fdcf28c";

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (document.getElementById("onesignal-sdk")) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = "onesignal-sdk";
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
    document.head.appendChild(s);
  });
}

export async function initOneSignal(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  if (typeof window === "undefined") return;

  // Skip in iframes / preview hosts (service workers + push are unreliable there)
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  if (isInIframe) return;

  initPromise = (async () => {
    await loadSdk();
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    await new Promise<void>((resolve) => {
      window.OneSignalDeferred!.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: "/OneSignalSDKWorker.js",
            serviceWorkerParam: { scope: "/" },
            notifyButton: { enable: false },
          });
          initialized = true;
        } catch (e) {
          console.warn("OneSignal init failed:", e);
        } finally {
          resolve();
        }
      });
    });
  })();

  return initPromise;
}

/**
 * Bind the current Supabase user to OneSignal (external_id = user.id),
 * prompt for permission if needed, then upsert the player_id into our DB
 * scoped to the user's hotel. This is what enables hotel-scoped sends.
 */
export async function loginOneSignalUser(userId: string, hotelId: string): Promise<void> {
  if (typeof window === "undefined") return;
  await initOneSignal();
  if (!initialized) return;

  return new Promise<void>((resolve) => {
    window.OneSignalDeferred!.push(async (OneSignal: any) => {
      try {
        await OneSignal.login(userId);

        // Ask for permission if not granted yet (browser will silently no-op if already decided)
        try {
          if (OneSignal.Notifications?.permission !== true) {
            await OneSignal.Notifications?.requestPermission();
          }
        } catch {}

        const playerId: string | undefined =
          OneSignal.User?.PushSubscription?.id ?? undefined;

        if (playerId) {
          await supabase
            .from("push_subscriptions" as any)
            .upsert(
              {
                user_id: userId,
                hotel_id: hotelId,
                onesignal_player_id: playerId,
                device_info: {
                  ua: navigator.userAgent,
                  lang: navigator.language,
                },
                last_seen_at: new Date().toISOString(),
              } as any,
              { onConflict: "user_id,onesignal_player_id" } as any,
            );
        }
      } catch (e) {
        console.warn("OneSignal login failed:", e);
      } finally {
        resolve();
      }
    });
  });
}

export async function logoutOneSignalUser(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  return new Promise<void>((resolve) => {
    window.OneSignalDeferred!.push(async (OneSignal: any) => {
      try { await OneSignal.logout(); } catch {}
      resolve();
    });
  });
}

/**
 * Trigger a hotel-scoped push from the client by calling the secure edge function.
 * The edge function enforces that the audience is limited to the caller's hotel.
 */
export async function sendHotelPush(args: {
  title: string;
  message: string;
  roles?: Array<"owner" | "manager" | "waiter" | "chef">;
  userIds?: string[];
  url?: string;
  data?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.functions.invoke("send-push", { body: args });
  if (error) throw error;
  return data;
}
