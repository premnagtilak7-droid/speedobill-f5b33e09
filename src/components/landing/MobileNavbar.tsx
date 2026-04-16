import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Zap, Menu, Receipt, Package, CreditCard, Headphones, X } from "lucide-react";
import { useState } from "react";

const menuItems = [
  { label: "Billing", icon: Receipt, target: "features" },
  { label: "Inventory", icon: Package, target: "features" },
  { label: "Pricing", icon: CreditCard, target: "pricing" },
  { label: "Support", icon: Headphones, target: "demo" },
];

const MobileNavbar = () => {
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => {
    setOpen(false);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:hidden">
      {/* Hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label="Open menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground">
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
              <Button className="w-full font-semibold">Get Started Free</Button>
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Center logo */}
      <Link to="/" className="flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold tracking-tight">
          Speedo<span className="text-primary">Bill</span>
        </span>
      </Link>

      {/* Login */}
      <Link to="/auth">
        <Button variant="ghost" size="sm" className="text-xs font-semibold">
          Log in
        </Button>
      </Link>
    </header>
  );
};

export default MobileNavbar;
