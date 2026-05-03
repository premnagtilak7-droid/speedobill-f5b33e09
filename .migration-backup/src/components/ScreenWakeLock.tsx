/**
 * Screen Wake Lock — keeps the tablet/phone screen on while a critical
 * route (Dashboard, KDS, Tables, Counter, etc.) is open.
 *
 * Uses the standard Screen Wake Lock API. Re-acquires the lock when the
 * tab regains visibility (the OS releases it on tab hide).
 *
 * Mounted once globally inside `<AppLayout />` — not on public marketing
 * routes — so any authenticated session benefits.
 */
import { useEffect, useRef } from "react";

type AnyWakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};

export default function ScreenWakeLock() {
  const lockRef = useRef<AnyWakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const wl = (navigator as any).wakeLock;
    if (!wl?.request) return; // Unsupported (older Safari / Firefox)

    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock: AnyWakeLockSentinel = await wl.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
        lock.addEventListener("release", () => {
          // Auto-released by OS (tab hidden, etc.). Will re-acquire on focus.
          lockRef.current = null;
        });
      } catch (e) {
        // Permission denied or low-battery saver mode — silent fallback
        console.warn("Wake Lock acquire failed:", e);
      }
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lockRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, []);

  return null;
}
