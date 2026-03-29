import { useState } from "react";
import { Bug, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

const BugReportButton = ({ collapsed = false }: { collapsed?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { user, role, hotelId } = useAuth();
  const location = useLocation();

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    try {
      const deviceInfo = `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`;
      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        hotel_id: hotelId,
        role: role || "unknown",
        page: location.pathname,
        message: message.trim(),
        device_info: deviceInfo,
      });
      if (error) throw error;
      toast.success("Bug report sent! Thank you for your feedback.");
      setMessage("");
      setOpen(false);
    } catch (err: any) {
      toast.error("Failed to send report. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[44px] active:scale-[0.97]"
      >
        <Bug className="h-[18px] w-[18px] flex-shrink-0" />
        {!collapsed && <span>Report a Bug</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              Report a Bug
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2">
              Page: <span className="font-mono">{location.pathname}</span> • Role: {role}
            </div>
            <Textarea
              placeholder="Describe what went wrong…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!message.trim() || sending} onClick={handleSubmit} className="gap-2">
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BugReportButton;
