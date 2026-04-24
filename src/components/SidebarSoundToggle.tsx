/**
 * Sidebar toggle to enable/disable in-app sound alerts.
 * When turned on, plays a 0.5s silent .mp3 to satisfy browser audio
 * gesture-unlock policies, then sets `isAudioEnabled = true`.
 */
import { Volume2, VolumeX } from "lucide-react";
import { useAudioNotification } from "@/contexts/AudioNotificationContext";
import { toast } from "sonner";

interface Props {
  collapsed: boolean;
}

export default function SidebarSoundToggle({ collapsed }: Props) {
  const { isAudioEnabled, enableAudio } = useAudioNotification();

  const handle = async () => {
    if (isAudioEnabled) {
      toast("Sound is already enabled. To disable, mute your device.", {
        duration: 2200,
      });
      return;
    }
    const ok = await enableAudio();
    if (ok) {
      toast.success("🔊 Sound enabled — you'll hear new orders");
    } else {
      toast.error("Could not unlock audio. Check browser permissions.");
    }
  };

  return (
    <button
      onClick={handle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] active:scale-[0.97] ${
        isAudioEnabled
          ? "text-emerald-500 hover:bg-emerald-500/10"
          : "text-amber-500 hover:bg-amber-500/10 animate-pulse"
      }`}
      aria-label={isAudioEnabled ? "Sound enabled" : "Enable sound"}
      title={isAudioEnabled ? "Sound is enabled" : "Click to enable order sound"}
    >
      {isAudioEnabled ? (
        <Volume2 className="h-[18px] w-[18px] flex-shrink-0" />
      ) : (
        <VolumeX className="h-[18px] w-[18px] flex-shrink-0" />
      )}
      {!collapsed && (
        <span className="font-medium">
          {isAudioEnabled ? "🔊 Sound On" : "🔊 Enable Sound"}
        </span>
      )}
    </button>
  );
}
