import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";

const STORAGE_KEY = "speedobill_app_banner_dismissed";
const PLAY_STORE_URL = "#"; // TODO: replace with actual Play Store listing URL

/**
 * Sticky banner shown only on mobile browsers (not on desktop, not when running
 * as installed PWA), prompting users to download the native app.
 */
const MobileAppBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {}

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    const isMobile = window.matchMedia?.("(max-width: 767px)").matches;

    setShow(!dismissed && isMobile && !isStandalone);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div
      className="sticky top-0 z-[60] flex items-center gap-3 px-3 py-2 text-white shadow-lg md:hidden"
      style={{ background: "linear-gradient(90deg, #0f1629 0%, #1a1040 100%)", borderBottom: "1px solid #1e2a45" }}
    >
      <Smartphone className="h-5 w-5 shrink-0 text-orange-400" />
      <p className="flex-1 text-xs font-medium leading-tight">
        Get the SpeedoBill App
      </p>
      <a
        href={PLAY_STORE_URL}
        className="rounded-md px-3 py-1.5 text-xs font-bold text-white shadow-md"
        style={{ backgroundColor: "#F97316" }}
      >
        Play Store
      </a>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="rounded-md p-1 text-slate-400 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default MobileAppBanner;
