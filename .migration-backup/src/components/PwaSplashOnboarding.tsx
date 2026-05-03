import { useEffect, useState } from "react";
import { Zap, Receipt, Package, BarChart3 } from "lucide-react";
import { APP_VERSION } from "@/constants/version";
import { Button } from "@/components/ui/button";

const ONBOARDING_KEY = "speedobill_onboarding_done";
const SPLASH_DURATION_MS = 2000;

type Phase = "splash" | "onboarding" | "done";

const slides = [
  { icon: Receipt, title: "Bill in 3 taps ⚡", desc: "Lightning-fast GST billing built for India's busiest counters." },
  { icon: Package, title: "Track inventory 📦", desc: "Real-time stock alerts so you never run out mid-service." },
  { icon: BarChart3, title: "Reports anywhere 📊", desc: "Know your numbers from your phone — sales, staff, profit." },
];

/**
 * Shown only when the app is launched as an installed PWA (display-mode: standalone).
 * 1. 2s splash with pulsing logo
 * 2. 3-slide onboarding (only first install) — stored in localStorage
 */
const PwaSplashOnboarding = () => {
  const [phase, setPhase] = useState<Phase>("done");
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (!isStandalone) return;

    setPhase("splash");
    const t = window.setTimeout(() => {
      let onboarded = false;
      try {
        onboarded = localStorage.getItem(ONBOARDING_KEY) === "1";
      } catch {}
      setPhase(onboarded ? "done" : "onboarding");
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(t);
  }, []);

  const finishOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {}
    setPhase("done");
  };

  if (phase === "done") return null;

  if (phase === "splash") {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
        style={{ background: "#0f1629" }}
      >
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            className="absolute inset-0 animate-ping rounded-3xl opacity-50"
            style={{ background: "rgba(249,115,22,0.4)" }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-3xl shadow-2xl"
            style={{ background: "linear-gradient(135deg, #F97316, #ea580c)" }}
          >
            <Zap className="h-12 w-12 text-white" />
          </div>
        </div>
        <p className="mt-8 text-2xl font-bold text-white tracking-tight">
          Speedo<span style={{ color: "#F97316" }}>Bill</span>
        </p>
        <p className="absolute bottom-8 text-xs text-slate-500">v{APP_VERSION}</p>
      </div>
    );
  }

  // onboarding
  const current = slides[slide];
  const Icon = current.icon;
  const isLast = slide === slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col px-6 pb-8 pt-12"
      style={{ background: "#0f1629" }}
    >
      <div className="flex items-center justify-end">
        <button
          onClick={finishOnboarding}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="mb-10 flex h-28 w-28 items-center justify-center rounded-3xl"
          style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)" }}
        >
          <Icon className="h-14 w-14 text-orange-500" />
        </div>
        <h2 className="text-3xl font-bold text-white">{current.title}</h2>
        <p className="mt-4 max-w-xs text-base text-slate-400">{current.desc}</p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-orange-500" : "w-2 bg-slate-600"}`}
          />
        ))}
      </div>

      <Button
        size="lg"
        className="h-12 w-full rounded-xl text-base font-semibold"
        style={{ backgroundColor: "#F97316" }}
        onClick={() => (isLast ? finishOnboarding() : setSlide((s) => s + 1))}
      >
        {isLast ? "Get Started" : "Next"}
      </Button>
    </div>
  );
};

export default PwaSplashOnboarding;
