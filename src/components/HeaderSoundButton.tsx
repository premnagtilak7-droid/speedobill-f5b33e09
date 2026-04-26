/**
 * Compact header button to enable in-app sound alerts.
 * Sits in the staff top-bar (mobile + desktop) so chefs/waiters can
 * unlock browser audio in one tap from any screen.
 */
import { Volume2, VolumeX } from "lucide-react";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";
import { toast } from "sonner";

export default function HeaderSoundButton() {
  const { isAudioEnabled, enableAudio } = useAudioNotification();

  const handle = async () => {
    if (isAudioEnabled) {
      toast("🔊 Sound is already on", { duration: 1800 });
      return;
    }
    const ok = await enableAudio();
    if (ok) toast.success("🔊 Sound enabled — you'll hear new orders");
    else toast.error("Could not unlock audio. Check browser permissions.");
  };

  return (
    <button
      onClick={handle}
      aria-label={isAudioEnabled ? "Sound enabled" : "Click to enable sound"}
      title={isAudioEnabled ? "Sound is enabled" : "🔔 Click to Enable Sound"}
      className={`relative p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
        isAudioEnabled
          ? "text-emerald-500 hover:bg-emerald-500/10"
          : "text-amber-500 hover:bg-amber-500/10 animate-pulse"
      }`}
    >
      {isAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      {!isAudioEnabled && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </button>
  );
}
