import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence, type MotionValue } from "framer-motion";
import { Zap, Package, BarChart3, CheckCircle2 } from "lucide-react";
import billingImg from "@/assets/billing-dashboard-mockup.jpg";
import inventoryImg from "@/assets/inventory-alerts-phone.jpg";
import analyticsImg from "@/assets/analytics-dashboard-mockup.jpg";

function useActiveIndex(mv: MotionValue<number>): [number, (i: number) => void] {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const unsub = mv.on("change", (v) => setActive(Math.round(v)));
    return () => unsub();
  }, [mv]);
  return [active, setActive];
}

const features = [
  {
    id: "billing",
    icon: Zap,
    eyebrow: "01 — Billing",
    title: "Swift Billing",
    desc: "Bill any order in 3 taps. Print thermal receipts with UPI QR, send WhatsApp digital bills, and split payments instantly.",
    bullets: ["3-tap counter billing", "5% GST auto-calc", "Split Cash · UPI · Card", "WhatsApp receipts"],
    image: billingImg,
    accent: "from-orange-500/30 to-amber-500/10",
  },
  {
    id: "inventory",
    icon: Package,
    eyebrow: "02 — Inventory",
    title: "Smart Inventory",
    desc: "Recipe-based auto-deduction with live low-stock push alerts on your phone. Never run out of an ingredient mid-service again.",
    bullets: ["Live low-stock alerts", "Recipe auto-deduction", "Vendor & purchase logs", "Wastage tracking"],
    image: inventoryImg,
    accent: "from-emerald-500/30 to-teal-500/10",
  },
  {
    id: "analytics",
    icon: BarChart3,
    eyebrow: "03 — Analytics",
    title: "Business Analytics",
    desc: "Real-time dashboards for revenue, top-sellers, staff performance and daily profit. Make decisions backed by data, not guesses.",
    bullets: ["Daily P&L reports", "Top-selling items", "Staff performance KPIs", "Export to Excel"],
    image: analyticsImg,
    accent: "from-indigo-500/30 to-violet-500/10",
  },
];

const StickyScrollFeatures = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Map scroll progress to active index (0, 1, 2)
  const activeIndex = useTransform(scrollYProgress, (v) => {
    if (v < 0.33) return 0;
    if (v < 0.66) return 1;
    return 2;
  });

  // We use state via motion value listener for image switching
  const [active, setActive] = useActiveIndex(activeIndex);

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className="relative border-t bg-gradient-to-b from-background via-muted/20 to-background"
      style={{ height: "300vh" }}
    >
      {/* Sticky inner container */}
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — text blocks */}
          <div className="relative">
            <div className="mb-10 hidden lg:block">
              <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                Why SpeedoBill
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                One platform.<br />Three superpowers.
              </h2>
            </div>

            <div className="flex flex-col gap-6 lg:gap-10">
              {features.map((f, i) => {
                const isActive = active === i;
                return (
                  <motion.div
                    key={f.id}
                    onViewportEnter={() => setActive(i)}
                    viewport={{ amount: 0.6, margin: "-40% 0px -40% 0px" }}
                    animate={{
                      opacity: isActive ? 1 : 0.35,
                      x: isActive ? 0 : -8,
                    }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="relative pl-6"
                  >
                    {/* vertical accent bar */}
                    <motion.div
                      className="absolute left-0 top-2 h-[calc(100%-1rem)] w-1 rounded-full bg-primary"
                      animate={{
                        opacity: isActive ? 1 : 0.15,
                        scaleY: isActive ? 1 : 0.6,
                      }}
                      style={{ transformOrigin: "top" }}
                      transition={{ duration: 0.5 }}
                    />
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <f.icon className="h-4 w-4" />
                      {f.eyebrow}
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-3 max-w-md text-base text-muted-foreground">
                      {f.desc}
                    </p>
                    <motion.ul
                      className="mt-4 grid gap-2 sm:grid-cols-2"
                      animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0 }}
                      style={{ overflow: "hidden" }}
                      transition={{ duration: 0.4 }}
                    >
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {b}
                        </li>
                      ))}
                    </motion.ul>
                  </motion.div>
                );
              })}
            </div>

            {/* progress dots — mobile only */}
            <div className="mt-8 flex justify-center gap-2 lg:hidden">
              {features.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    active === i ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — sticky image stack */}
          <div className="relative mx-auto w-full max-w-lg">
            <div
              className={`absolute -inset-8 rounded-[2rem] bg-gradient-to-br ${features[active].accent} blur-3xl transition-all duration-700`}
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/20">
              <AnimatePresence mode="wait">
                <motion.img
                  key={features[active].id}
                  src={features[active].image}
                  alt={features[active].title}
                  className="absolute inset-0 h-full w-full object-cover"
                  width={1280}
                  height={960}
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0, scale: 1.05, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -10 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </AnimatePresence>

              {/* Floating label badge */}
              <motion.div
                key={`badge-${features[active].id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white shadow-xl backdrop-blur-md"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  {(() => {
                    const Icon = features[active].icon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {features[active].eyebrow}
                  </p>
                  <p className="text-sm font-semibold">{features[active].title}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default StickyScrollFeatures;
