import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LandingNavbar from "@/components/landing/LandingNavbar";
import {
  Zap, LayoutDashboard, ChefHat, QrCode, Users, BarChart3,
  ShieldCheck, Smartphone, ArrowRight, Star, CheckCircle2,
} from "lucide-react";

const features = [
  { icon: LayoutDashboard, title: "Smart Dashboard", desc: "Real-time sales, orders & analytics at a glance." },
  { icon: ChefHat, title: "Kitchen Display (KDS)", desc: "Live KOT tickets with priority alerts for chefs." },
  { icon: QrCode, title: "QR Table Ordering", desc: "Guests scan, browse & order — no app download." },
  { icon: Users, title: "Staff & Role Management", desc: "Owner, Manager, Waiter, Chef — granular RBAC." },
  { icon: BarChart3, title: "Analytics & Reports", desc: "Revenue trends, top sellers & daily closing reports." },
  { icon: ShieldCheck, title: "Inventory Hub", desc: "Track stock, recipes, vendors & wastage in one place." },
];

const plans = [
  { name: "Free", price: "₹0", period: "/forever", features: ["Up to 10 tables", "Basic POS", "QR ordering", "1 staff account"], cta: "Start Free" },
  { name: "Basic", price: "₹199", period: "/month", features: ["Up to 20 tables", "KDS & KOT", "Staff management", "Order history"], cta: "Upgrade", popular: true },
  { name: "Premium", price: "₹499", period: "/month", features: ["Unlimited tables", "Full analytics", "Inventory hub", "Priority support"], cta: "Go Premium" },
];

const LandingPage = () => (
  <div className="min-h-screen bg-background text-foreground">
    <LandingNavbar />

    {/* Hero */}
    <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Zap className="h-4 w-4" /> Built for Indian Restaurants
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          The all-in-one POS for
          <span className="block text-primary">modern restaurants</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Billing, KDS, QR ordering, inventory & analytics — everything you need to run your restaurant, from a single dashboard.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/auth">
            <Button size="lg" className="gap-2 px-8 text-base font-semibold">
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="gap-2 px-8 text-base" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
            See Features
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">No credit card required · 7-day free trial</p>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="border-t bg-muted/30 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything your restaurant needs
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          From front-of-house to back-of-house, Speedo Bill covers every aspect of restaurant operations.
        </p>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="group border-border/50 bg-card/80 backdrop-blur transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>

    {/* Pricing */}
    <section id="pricing" className="border-t px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          Start free. Upgrade when you're ready.
        </p>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.name} className={`relative flex flex-col ${p.popular ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border/50"}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <CardContent className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="mt-8">
                  <Button className="w-full" variant={p.popular ? "default" : "outline"}>
                    {p.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section id="testimonials" className="border-t bg-muted/30 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Loved by restaurant owners
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Rajesh K.", role: "Owner, Spice Garden", text: "Speedo Bill replaced 3 separate apps. My staff learned it in one day." },
            { name: "Priya M.", role: "Manager, Café Bloom", text: "The QR ordering alone saved us from hiring an extra waiter." },
            { name: "Arjun S.", role: "Owner, Biryani House", text: "KDS alerts mean zero missed orders. Our kitchen runs like clockwork now." },
          ].map((t) => (
            <Card key={t.name} className="border-border/50 bg-card/80">
              <CardContent className="p-6">
                <div className="mb-3 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">"{t.text}"</p>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="border-t px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <Smartphone className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to modernize your restaurant?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Join hundreds of restaurants already using Speedo Bill.
        </p>
        <Link to="/auth">
          <Button size="lg" className="mt-8 gap-2 px-10 text-base font-semibold">
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Speedo Bill</span>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/support" className="hover:text-foreground">Support</Link>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 Speedo Bill. All rights reserved.</p>
      </div>
    </footer>
  </div>
);

export default LandingPage;
