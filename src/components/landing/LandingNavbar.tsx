import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Receipt,
  Package,
  BarChart3,
  Users,
  UserCog,
  Bell,
  QrCode,
  MessageSquare,
  Star,
  type LucideIcon,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

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

const DropdownPanel = ({ items }: { items: DropdownItem[] }) => (
  <ul
    className="grid w-[280px] gap-1 p-2"
    style={{ backgroundColor: "#0a0e1a", border: "1px solid #1e2a45", borderRadius: "0.75rem" }}
  >
    {items.map((item) => (
      <li key={item.to}>
        <Link
          to={item.to}
          className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/10 text-orange-500 transition-colors group-hover:bg-orange-500/20">
            <item.icon className="h-4 w-4" />
          </span>
          <span className="font-medium">{item.label}</span>
        </Link>
      </li>
    ))}
  </ul>
);

const LandingNavbar = () => {
  const { t } = useTranslation();

  const triggerCls =
    "bg-transparent text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground";

  return (
    <header className="sticky top-0 z-50 hidden w-full border-b border-border/40 bg-background/80 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Speedo<span className="text-primary">Bill</span>
          </span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList className="gap-2">
            <NavigationMenuItem>
              <NavigationMenuTrigger className={triggerCls}>Products</NavigationMenuTrigger>
              <NavigationMenuContent>
                <DropdownPanel items={productItems} />
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className={triggerCls}>Add-ons</NavigationMenuTrigger>
              <NavigationMenuContent>
                <DropdownPanel items={addonItems} />
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                to="/pricing"
                className="inline-flex h-10 items-center px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.pricing")}
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                to="/about"
                className="inline-flex h-10 items-center px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                About Us
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/auth">
            <Button variant="ghost" size="sm">{t("nav.login")}</Button>
          </Link>
          <a href="/#demo">
            <Button size="sm" className="font-semibold">
              Book a Demo
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;
