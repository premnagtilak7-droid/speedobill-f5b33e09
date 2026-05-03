import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Building2, Zap, Sparkles } from "lucide-react";

type Stat = {
  icon: typeof Building2;
  target: number;
  suffix: string;
  prefix?: string;
  label: string;
};

const STATS: Stat[] = [
  { icon: Building2, target: 500, suffix: "+", label: "Businesses using SpeedoBill" },
  { icon: Zap, target: 10, suffix: "x", label: "Faster than manual billing" },
  { icon: Sparkles, target: 0, prefix: "₹", suffix: "", label: "To get started today" },
];

const CountUp = ({ target, duration = 1600, start }: { target: number; duration?: number; start: boolean }) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    if (target === 0) {
      setValue(0);
      return;
    }
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [start, target, duration]);

  return <>{value}</>;
};

const StatsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section
      ref={ref}
      className="px-4 py-16 sm:px-6 lg:px-8"
      style={{ background: "linear-gradient(180deg, #0f172a 0%, #0a0e1a 100%)" }}
      aria-label="Trusted by 500+ Businesses"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Trusted by 500+ Businesses
          </h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm sm:p-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/10">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
                className="flex flex-col items-center px-6 text-center"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(249, 115, 22, 0.1)" }}
                >
                  <s.icon className="h-6 w-6" style={{ color: "#F97316" }} />
                </div>
                <div className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                  {s.prefix}
                  <CountUp target={s.target} start={inView} />
                  <span>{s.suffix}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400 sm:text-base">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
