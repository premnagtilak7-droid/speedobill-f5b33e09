/**
 * Prominent "Start Shift & Enable Audio" banner shown on the Dashboard.
 * Auto-hides once audio has been unlocked. The click satisfies the browser's
 * user-gesture requirement for AudioContext + media playback.
 */
import { Button } from "@/components/ui/button";
import { Bell, Volume2, CheckCircle2 } from "lucide-react";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";
import { toast } from "sonner";
import { useState } from "react";

export default function StartShiftAudioBanner() {
  const { isAudioEnabled, enableAudio } = useAudioNotification();
  const [busy, setBusy] = useState(false);

  if (isAudioEnabled) return null;

  const handle = async () => {
    setBusy(true);
    const ok = await enableAudio();
    setBusy(false);
    if (ok) {
      toast.success("🔔 Shift started — audio alerts are live", { duration: 2200 });
    } else {
      toast.error("Could not unlock audio. Check browser sound permissions.");
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/30 animate-pop-in"
      style={{
        background:
          "linear-gradient(135deg, hsl(38 92% 50% / 0.18) 0%, hsl(20 90% 55% / 0.12) 100%)",
      }}
    >
      <div className="absolute -top-10 -right-6 w-[180px] h-[180px] pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(38 92% 50% / 0.25), transparent 70%)" }}
      />
      <div className="relative px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-500/20 ring-1 ring-amber-500/40 flex items-center justify-center animate-pulse">
            <Volume2 className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm md:text-base font-semibold text-foreground flex items-center gap-2">
              Audio alerts are muted
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Action needed
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Browsers block sound until you tap once. Start your shift to hear new-order bells.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          onClick={handle}
          disabled={busy}
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-[0_4px_20px_-4px_hsl(38_92%_50%/0.6)]"
        >
          {busy ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2 animate-spin" /> Enabling…
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" /> 🔔 Start Shift &amp; Enable Audio
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
