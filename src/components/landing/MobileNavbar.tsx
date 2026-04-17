import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Zap, Menu, Receipt, Package, CreditCard, Headphones } from "lucide-react";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const MobileNavbar = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const menuItems = [
    { label: t("nav.billing"), icon: Receipt, target: "features" },
    { label: t("nav.inventory"), icon: Package, target: "features" },
    { label: t("nav.pricing"), icon: CreditCard, target: "pricing" },
    { label: t("nav.support"), icon: Headphones, target: "demo" },
  ];

  const scrollTo = (id: string) => {
    setOpen(false);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label={t("nav.openMenu")} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-background p-0">
          <SheetHeader className="border-b border-border/40 px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Speedo<span className="text-primary">Bill</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollTo(item.target)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-border/40 p-4">
            <Link to="/auth" onClick={() => setOpen(false)}>
              <Button className="w-full font-semibold">{t("nav.getStarted")}</Button>
            </Link>
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
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="text-xs font-semibold px-2">
            {t("nav.login")}
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default MobileNavbar;
