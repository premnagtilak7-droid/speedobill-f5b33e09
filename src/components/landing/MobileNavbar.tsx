import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Zap,
  Menu,
  Receipt,
  Package,
  BarChart3,
  Users,
  UserCog,
  Bell,
  QrCode,
  MessageSquare,
  Star,
  CreditCard,
  Info,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type DropdownItem = { label: string; to: string; icon: LucideIcon };

const productItems: DropdownItem[] = [
  { label: "Billing & POS", to: "/features/billing", icon: Receipt },
  { label: "Inventory Management", to: "/features/inventory", icon: Package },
  { label: "Reports & Analytics", to: "/features/reports", icon: BarChart3 },
  { label: "Staff & Payroll", to: "/features/payroll", icon: UserCog },
  { label: "Customer Management", to: "/features/customers", icon: Users },
];

const addonItems: DropdownItem[] = [
  { label: "Waiter Calling System", to: "/addons/waiter-calling", icon: Bell },
  { label: "QR Scan & Pay", to: "/addons/qr-pay", icon: QrCode },
  { label: "SMS Marketing", to: "/addons/sms-marketing", icon: MessageSquare },
  { label: "Customer Feedback", to: "/addons/feedback", icon: Star },
];

const MobileNavbar = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const renderItem = (item: DropdownItem) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={close}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10 text-orange-500">
        <item.icon className="h-4 w-4" />
      </span>
      {item.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label={t("nav.openMenu")} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0" style={{ backgroundColor: "#0a0e1a", borderRight: "1px solid #1e2a45" }}>
          <SheetHeader className="border-b px-5 py-4" style={{ borderColor: "#1e2a45" }}>
            <SheetTitle className="flex items-center gap-2 text-left">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Speedo<span className="text-primary">Bill</span>
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex h-[calc(100%-65px)] flex-col">
            <nav className="flex-1 overflow-y-auto p-3">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="products" className="border-b" style={{ borderColor: "#1e2a45" }}>
                  <AccordionTrigger className="px-3 py-3 text-sm font-medium text-slate-200 hover:text-orange-400 hover:no-underline">
                    Products
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="flex flex-col gap-1 pl-2">
                      {productItems.map(renderItem)}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="addons" className="border-b" style={{ borderColor: "#1e2a45" }}>
                  <AccordionTrigger className="px-3 py-3 text-sm font-medium text-slate-200 hover:text-orange-400 hover:no-underline">
                    Add-ons
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="flex flex-col gap-1 pl-2">
                      {addonItems.map(renderItem)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Link
                to="/pricing"
                onClick={close}
                className="mt-1 flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
              >
                <CreditCard className="h-5 w-5 text-orange-500" />
                {t("nav.pricing")}
              </Link>
              <Link
                to="/about"
                onClick={close}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Info className="h-5 w-5 text-orange-500" />
                About Us
              </Link>
            </nav>

            <div className="border-t p-4" style={{ borderColor: "#1e2a45" }}>
              <a href="/#request-access" onClick={close}>
                <Button className="w-full font-semibold">Request Access</Button>
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Link to="/" className="flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold tracking-tight">
          Speedo<span className="text-primary">Bill</span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <a href="/#request-access">
          <Button size="sm" className="text-xs font-semibold px-2">
            Request Access
          </Button>
        </a>
      </div>
    </header>
  );
};

export default MobileNavbar;
