import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

const LandingNavbar = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Speedo<span className="text-primary">Bill</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <button onClick={() => scrollTo("features")} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Features
          </button>
          <button onClick={() => scrollTo("pricing")} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </button>
          <button onClick={() => scrollTo("testimonials")} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Testimonials
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="font-semibold">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;
