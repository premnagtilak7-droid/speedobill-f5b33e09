import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LandingNavbar from "@/components/landing/LandingNavbar";
import MobileNavbar from "@/components/landing/MobileNavbar";
import DemoRequestForm from "@/components/landing/DemoRequestForm";
import DemoBookingForm from "@/components/landing/DemoBookingForm";
import LandingFooter from "@/components/landing/LandingFooter";
import MultiTerminalSection from "@/components/landing/MultiTerminalSection";
import AddOnsSection from "@/components/landing/AddOnsSection";
import StickyScrollFeatures from "@/components/landing/StickyScrollFeatures";
import TrustBar from "@/components/landing/TrustBar";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FaqSection from "@/components/landing/FaqSection";
import ScrollReveal from "@/components/ScrollReveal";
import {
  Zap, LayoutDashboard, ChefHat, QrCode, Users, BarChart3,
  ShieldCheck, Smartphone, ArrowRight, Star, CheckCircle2,
} from "lucide-react";
import ownerTabletImg from "@/assets/owner-tablet-hero.jpg";
import thermalReceiptImg from "@/assets/thermal-receipt-mockup.jpg";
import inventoryAlertsImg from "@/assets/inventory-alerts-phone.jpg";

const features = [
  { icon: Zap, title: "Instant POS", desc: "3-tap billing designed for high-speed canteen counters." },
  { icon: Smartphone, title: "Waiter App", desc: "Let your staff take orders from any mobile device." },
  { icon: ShieldCheck, title: "Inventory Control", desc: "Real-time tracking of ingredients and stock levels." },
  { icon: QrCode, title: "WhatsApp Billing", desc: "Go paperless and send digital bills directly to customers." },
  { icon: BarChart3, title: "Admin Reports", desc: "Detailed daily sales and profit analytics for the owner." },
  { icon: LayoutDashboard, title: "Cloud Sync", desc: "Access your canteen data from anywhere in the world." },
];

const plans = [
  { name: "Free", price: "₹0", period: "/forever", features: ["Up to 10 tables", "Basic POS", "QR ordering", "1 staff account"], cta: "Start Free" },
  { name: "Basic", price: "₹199", period: "/month", features: ["Up to 20 tables", "KDS & KOT", "Staff management", "Order history"], cta: "Upgrade", popular: true },
  { name: "Premium", price: "₹499", period: "/month", features: ["Unlimited tables", "Full analytics", "Inventory hub", "Priority support"], cta: "Go Premium" },
];

const ROTATING_WORDS = ["Canteens", "Restaurants", "Hotels", "Retail Shops", "Cafes"];

const LandingPage = () => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
  <div className="min-h-screen bg-background text-foreground scroll-smooth">
    <MobileNavbar />
    <LandingNavbar />

    {/* Hero */}
    <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:px-8" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #0f172a 40%, #1a1040 100%)" }}>
      {/* Animated glow orbs */}
      <div className="absolute left-1/4 top-20 -z-0 h-72 w-72 rounded-full bg-orange-500/10 blur-[100px]" />
      <div className="absolute right-1/4 bottom-10 -z-0 h-60 w-60 rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute left-1/2 top-1/2 -z-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 blur-[80px]" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
        {/* Left — Copy */}
        <div className="flex-1 text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400">
            <Zap className="h-4 w-4" /> #1 POS for Indian Canteens
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
            Speedo Bill: The 10x Faster Billing System for{" "}
            <span className="relative inline-flex h-[1.15em] items-end overflow-hidden align-bottom">
              <AnimatePresence mode="wait">
                <motion.span
                  key={ROTATING_WORDS[wordIndex]}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="inline-block whitespace-nowrap"
                  style={{ color: "#F97316" }}
                >
                  {ROTATING_WORDS[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400 lg:mx-0">
            Reduce counter rush, send WhatsApp receipts, and manage your inventory with India's easiest POS software.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <Link to="/auth">
              <Button
                size="lg"
                className="relative gap-2 rounded-xl px-10 py-6 text-base font-bold shadow-[0_0_30px_hsl(25_95%_53%/0.35)] transition-shadow hover:shadow-[0_0_50px_hsl(25_95%_53%/0.5)]"
              >
                Start Free Trial <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl border-slate-700 bg-transparent px-8 py-6 text-base text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              See Features
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required · 7-day free trial</p>
        </div>

        {/* Right — Owner with tablet */}
        <div className="relative flex-1">
          <div className="relative mx-auto max-w-lg lg:max-w-xl">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-orange-500/20 via-transparent to-indigo-500/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl shadow-black/50">
              <img
                src={ownerTabletImg}
                alt="Restaurant owner using Speedo Bill on a tablet"
                className="block h-auto w-full"
                width={1280}
                height={960}
                fetchPriority="high"
              />
              <div className="absolute bottom-4 left-4 hidden rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-xl backdrop-blur-md sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Bill #1248</p>
                    <p className="text-sm font-semibold text-white">₹ 1,240 · 3 taps</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Trust Bar */}
    <TrustBar />

    {/* Stats */}
    <StatsSection />

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
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.12} duration={0.6} yOffset={28}>
              <Card className="group h-full border-border/50 bg-card/80 backdrop-blur transition-shadow hover:shadow-lg">
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    {/* How It Works */}
    <HowItWorksSection />

    {/* Billing showcase */}
    <section id="billing" className="border-t px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Billing & Receipts
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Print thermal receipts with UPI QR — instantly
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every bill is GST-ready, prints crisp on 58mm/80mm thermal printers, and includes a scan-to-pay QR so guests can settle in seconds.
          </p>
          <ul className="mt-6 space-y-3">
            {["5% GST auto-calculated", "Split payments (Cash · UPI · Card)", "WhatsApp digital receipts", "Reprint & void controls"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ScrollReveal className="relative mx-auto max-w-sm" duration={0.9} initialScale={0.88} yOffset={20} amount={0.25}>
            <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
            <img
              src={thermalReceiptImg}
              alt="Thermal printed restaurant receipt with UPI QR code"
              className="relative block h-auto w-full rounded-2xl shadow-2xl"
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
            />
          </ScrollReveal>
        </div>
      </div>
    </section>

    {/* Inventory showcase */}
    <section id="inventory" className="border-t bg-muted/30 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <ScrollReveal className="relative mx-auto max-w-sm" duration={0.9} initialScale={0.88} yOffset={20} amount={0.25}>
            <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-orange-500/20 to-indigo-500/20 blur-3xl" />
            <img
              src={inventoryAlertsImg}
              alt="Live low-stock inventory alerts on a phone screen"
              className="relative block h-auto w-full rounded-2xl shadow-2xl"
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
            />
          </ScrollReveal>
        </div>
        <div>
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Inventory & Stock
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Never run out of an ingredient again
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Real-time stock tracking with instant low-stock alerts on your phone. Auto-deduct ingredients per recipe with every order.
          </p>
          <ul className="mt-6 space-y-3">
            {["Live low-stock push alerts", "Recipe-based auto-deduction", "Vendor & purchase logs", "Wastage tracking with reasons"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    {/* Sticky Scroll Feature Showcase */}
    <StickyScrollFeatures />

    {/* Multi-Terminal */}
    <MultiTerminalSection />

    {/* Add-ons */}
    <AddOnsSection />

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
    <TestimonialsSection />

    {/* Schedule a Free Demo */}
    <section id="demo" className="border-t px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <ScrollReveal yOffset={50}>
          <Smartphone className="mb-4 h-10 w-10 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Schedule a Free Demo
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Fill in your details and a SpeedoBill expert will reach out on WhatsApp to set you up in minutes.
          </p>
          <ul className="mt-6 space-y-3">
            {["Free setup assistance", "No credit card required", "7-day free trial included", "Personalized onboarding call"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </ScrollReveal>
        <ScrollReveal yOffset={50} delay={0.15} stiffness={70} damping={16}>
          <DemoBookingForm />
        </ScrollReveal>
      </div>
    </section>

    {/* FAQ */}
    <FaqSection />

    {/* Footer */}
    <LandingFooter />
  </div>
  );
};

export default LandingPage;
