import { HelpCircle, MessageCircle, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SupportPage = () => (
  <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
    <h1 className="text-2xl font-bold flex items-center gap-2">
      <HelpCircle className="h-6 w-6 text-primary" /> Help & Support
    </h1>

    <Card>
      <CardHeader><CardTitle className="text-base">Contact Us</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => window.open("mailto:speedobill7@gmail.com")}>
          <Mail className="h-4 w-4" /> speedobill7@gmail.com
        </Button>
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => window.open("https://wa.me/919876543210", "_blank")}>
          <MessageCircle className="h-4 w-4" /> WhatsApp Support
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">FAQs</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-semibold">How do I add staff?</p>
          <p className="text-muted-foreground">Go to Staff → Add Staff, enter their email and role. They'll be assigned to your hotel automatically.</p>
        </div>
        <div>
          <p className="font-semibold">How do I activate my license?</p>
          <p className="text-muted-foreground">Go to Settings → Activate License and enter the key code provided.</p>
        </div>
        <div>
          <p className="font-semibold">How does the KDS (Kitchen Display) work?</p>
          <p className="text-muted-foreground">When a waiter sends an order to KDS, it appears on the chef's screen. The chef can start cooking, mark ready, and the waiter gets notified.</p>
        </div>
        <div>
          <p className="font-semibold">How does QR ordering work?</p>
          <p className="text-muted-foreground">Go to Table QR, print QR codes for each table. Customers scan and order from their phone — orders appear in your Incoming Orders panel.</p>
        </div>
      </CardContent>
    </Card>

    <p className="text-center text-xs text-muted-foreground">Speedo Bill v8.0 · © {new Date().getFullYear()}</p>
  </div>
);

export default SupportPage;
