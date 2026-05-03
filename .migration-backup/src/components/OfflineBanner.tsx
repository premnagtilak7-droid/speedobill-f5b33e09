import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold py-2 px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
    >
      <WifiOff className="h-4 w-4" />
      Connection Lost — You are offline
    </div>
  );
}
