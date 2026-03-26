import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe, Truck, CreditCard, MessageSquare, Printer, Bell,
  ExternalLink, Settings, Zap, ShoppingBag, UtensilsCrossed,
  Smartphone, QrCode, BarChart3, Link2, CheckCircle2, XCircle,
  ArrowRight, Phone, Mail, MapPin, Clock, IndianRupee
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "delivery" | "payments" | "marketing" | "operations" | "analytics";
  status: "connected" | "available" | "coming_soon";
  color: string;
  features: string[];
}

const INTEGRATIONS: Integration[] = [
  // Delivery Platforms
  {
    id: "zomato",
    name: "Zomato",
    description: "Auto-accept orders from Zomato directly into your POS. Sync menu, prices & availability in real-time.",
    icon: <UtensilsCrossed className="h-6 w-6" />,
    category: "delivery",
    status: "available",
    color: "text-red-500",
    features: ["Auto-accept orders", "Menu sync", "Price sync", "Order status tracking", "Rating management"],
  },
  {
    id: "swiggy",
    name: "Swiggy",
    description: "Receive Swiggy orders in your kitchen display. Auto-update item availability & track delivery status.",
    icon: <ShoppingBag className="h-6 w-6" />,
    category: "delivery",
    status: "available",
    color: "text-orange-500",
    features: ["Order auto-import", "Menu management", "Delivery tracking", "Revenue reports", "Item availability sync"],
  },
  {
    id: "dunzo",
    name: "Dunzo",
    description: "Enable hyperlocal delivery for your restaurant. Customers order via your app, Dunzo delivers.",
    icon: <Truck className="h-6 w-6" />,
    category: "delivery",
    status: "coming_soon",
    color: "text-green-500",
    features: ["Hyperlocal delivery", "Live tracking", "Auto-dispatch", "Delivery cost estimation"],
  },
  {
    id: "website_orders",
    name: "Website Orders",
    description: "Accept orders directly from your restaurant website or custom domain. Zero commission.",
    icon: <Globe className="h-6 w-6" />,
    category: "delivery",
    status: "available",
    color: "text-blue-500",
    features: ["Zero commission", "Custom domain", "SEO optimized menu", "Online payments", "Order tracking page"],
  },
  // Payments
  {
    id: "razorpay",
    name: "Razorpay",
    description: "Accept UPI, cards, net banking & wallets. Auto-reconcile payments with bills.",
    icon: <CreditCard className="h-6 w-6" />,
    category: "payments",
    status: "connected",
    color: "text-blue-600",
    features: ["UPI payments", "Card payments", "Auto-reconciliation", "Payment links", "Refund management"],
  },
  {
    id: "phonepe_biz",
    name: "PhonePe Business",
    description: "Accept PhonePe, UPI & wallet payments at your counter with sound-box alerts.",
    icon: <IndianRupee className="h-6 w-6" />,
    category: "payments",
    status: "available",
    color: "text-purple-600",
    features: ["UPI QR payments", "Sound-box alerts", "Auto-settlement", "Transaction history"],
  },
  {
    id: "paytm_biz",
    name: "Paytm for Business",
    description: "Paytm QR, wallet, and UPI payments with instant settlement.",
    icon: <Smartphone className="h-6 w-6" />,
    category: "payments",
    status: "coming_soon",
    color: "text-sky-500",
    features: ["Paytm QR", "Wallet payments", "Instant settlement", "EDC machine support"],
  },
  // Marketing
  {
    id: "whatsapp_biz",
    name: "WhatsApp Business",
    description: "Send order confirmations, bills & promotional messages to customers on WhatsApp.",
    icon: <MessageSquare className="h-6 w-6" />,
    category: "marketing",
    status: "available",
    color: "text-green-600",
    features: ["Order confirmations", "Digital bills", "Promo broadcasts", "Feedback collection", "Reservation reminders"],
  },
  {
    id: "google_business",
    name: "Google Business Profile",
    description: "Auto-update your Google listing with menu, hours, photos & respond to reviews.",
    icon: <Globe className="h-6 w-6" />,
    category: "marketing",
    status: "coming_soon",
    color: "text-yellow-500",
    features: ["Menu sync", "Hours update", "Photo upload", "Review management", "Insights & analytics"],
  },
  // Operations
  {
    id: "printer",
    name: "Thermal Printer",
    description: "Print KOT tickets and bills on any Bluetooth or USB thermal printer.",
    icon: <Printer className="h-6 w-6" />,
    category: "operations",
    status: "available",
    color: "text-foreground",
    features: ["KOT printing", "Bill printing", "Multi-printer support", "Custom templates", "Auto-print on order"],
  },
  {
    id: "qr_ordering",
    name: "QR Table Ordering",
    description: "Customers scan table QR → browse menu → place order. Already built into Speedo Bill!",
    icon: <QrCode className="h-6 w-6" />,
    category: "operations",
    status: "connected",
    color: "text-primary",
    features: ["Table-wise QR codes", "Live menu", "Customer self-order", "Modifier support", "No app needed"],
  },
  {
    id: "push_notifications",
    name: "Push Notifications",
    description: "Instant alerts for new orders, KDS updates, low stock & service calls.",
    icon: <Bell className="h-6 w-6" />,
    category: "operations",
    status: "available",
    color: "text-amber-500",
    features: ["Order alerts", "KDS notifications", "Low stock warnings", "Service call alerts"],
  },
  // Analytics
  {
    id: "google_analytics",
    name: "Google Analytics",
    description: "Track your customer ordering page visits, conversions & popular menu items.",
    icon: <BarChart3 className="h-6 w-6" />,
    category: "analytics",
    status: "coming_soon",
    color: "text-yellow-600",
    features: ["Page views", "Conversion tracking", "Popular items", "Traffic sources"],
  },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  delivery: { label: "Delivery & Orders", icon: <Truck className="h-4 w-4" /> },
  payments: { label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  marketing: { label: "Marketing & CRM", icon: <MessageSquare className="h-4 w-4" /> },
  operations: { label: "Operations", icon: <Settings className="h-4 w-4" /> },
  analytics: { label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
};

const IntegrationsPage = () => {
  const { hotelId } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configuring, setConfiguring] = useState(false);

  const filtered = activeTab === "all"
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeTab);

  const connectedCount = INTEGRATIONS.filter(i => i.status === "connected").length;
  const availableCount = INTEGRATIONS.filter(i => i.status === "available").length;

  const handleConnect = (integration: Integration) => {
    if (integration.status === "coming_soon") {
      toast.info(`${integration.name} integration is coming soon! We'll notify you.`);
      return;
    }
    setSelectedIntegration(integration);
  };

  const handleActivate = () => {
    if (!selectedIntegration) return;
    setConfiguring(true);
    setTimeout(() => {
      setConfiguring(false);
      toast.success(`${selectedIntegration.name} integration request submitted! Our team will set it up within 24 hours.`);
      setSelectedIntegration(null);
    }, 1500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>;
      case "available":
        return <Badge variant="outline" className="text-primary border-primary/30"><Zap className="h-3 w-3 mr-1" /> Available</Badge>;
      case "coming_soon":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Coming Soon</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" /> Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your restaurant with delivery platforms, payment gateways & more
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" /> {connectedCount} Connected
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 mr-1 text-primary" /> {availableCount} Available
          </Badge>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
            <TabsTrigger key={key} value={key} className="text-xs flex items-center gap-1">
              {icon} {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(integration => (
              <Card
                key={integration.id}
                className={`glass-card hover:border-primary/30 transition-all cursor-pointer group ${
                  integration.status === "coming_soon" ? "opacity-70" : ""
                }`}
                onClick={() => handleConnect(integration)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center ${integration.color}`}>
                        {integration.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{integration.name}</h3>
                        <p className="text-[10px] text-muted-foreground capitalize">{integration.category}</p>
                      </div>
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {integration.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {integration.features.slice(0, 3).map(f => (
                      <Badge key={f} variant="secondary" className="text-[10px] font-normal">{f}</Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] font-normal">+{integration.features.length - 3} more</Badge>
                    )}
                  </div>

                  <Button
                    variant={integration.status === "connected" ? "outline" : integration.status === "coming_soon" ? "ghost" : "default"}
                    size="sm"
                    className="w-full text-xs group-hover:shadow-sm transition-shadow"
                  >
                    {integration.status === "connected" ? (
                      <><Settings className="h-3.5 w-3.5 mr-1" /> Manage</>
                    ) : integration.status === "coming_soon" ? (
                      <><Bell className="h-3.5 w-3.5 mr-1" /> Notify Me</>
                    ) : (
                      <><ArrowRight className="h-3.5 w-3.5 mr-1" /> Connect</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Integration Detail Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={(o) => !o && setSelectedIntegration(null)}>
        <DialogContent className="max-w-md">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center ${selectedIntegration.color}`}>
                    {selectedIntegration.icon}
                  </div>
                  <div>
                    <p>{selectedIntegration.name}</p>
                    <p className="text-sm text-muted-foreground font-normal capitalize">{selectedIntegration.category}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">{selectedIntegration.description}</p>

                {getStatusBadge(selectedIntegration.status)}

                <div>
                  <h4 className="text-sm font-semibold mb-2">Features included:</h4>
                  <div className="space-y-1.5">
                    {selectedIntegration.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedIntegration.status === "connected" ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> This integration is active and working
                    </p>
                  </div>
                ) : selectedIntegration.status === "coming_soon" ? (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-muted-foreground">
                      This integration is under development. We'll notify you when it's ready!
                    </p>
                  </div>
                ) : (
                  <Button className="w-full" onClick={handleActivate} disabled={configuring}>
                    {configuring ? "Submitting..." : `Connect ${selectedIntegration.name}`}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationsPage;
