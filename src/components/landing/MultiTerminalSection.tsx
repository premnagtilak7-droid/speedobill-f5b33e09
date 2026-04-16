import { Monitor, Tablet, ChefHat, ArrowRight } from "lucide-react";

const terminals = [
  {
    icon: Monitor,
    title: "Master POS",
    subtitle: "Desktop / PC",
    desc: "Central billing hub for the cashier counter with full reports and controls.",
    color: "from-orange-500/20 to-orange-500/5",
    iconBg: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: Tablet,
    title: "Waiter Tabs",
    subtitle: "Mobile / Tablet",
    desc: "Staff take orders tableside on any Android phone — synced instantly.",
    color: "from-indigo-500/20 to-indigo-500/5",
    iconBg: "bg-indigo-500/10 text-indigo-500",
  },
  {
    icon: ChefHat,
    title: "KOT Display",
    subtitle: "Kitchen Screen",
    desc: "Live order tickets for chefs with status, timers and color-coded urgency.",
    color: "from-emerald-500/20 to-emerald-500/5",
    iconBg: "bg-emerald-500/10 text-emerald-500",
  },
];

const MultiTerminalSection = () => (
  <section className="border-t bg-muted/30 px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="text-center">
        <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          One Platform · Three Devices
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Run your entire restaurant from any device
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Speedo Bill keeps your counter, waiters and kitchen perfectly in sync — in real time.
        </p>
      </div>

      <div className="mt-16 grid items-stretch gap-6 md:grid-cols-3 md:gap-4 lg:gap-8">
        {terminals.map((t, i) => (
          <div key={t.title} className="relative flex">
            <div className={`relative flex w-full flex-col rounded-2xl border bg-gradient-to-br ${t.color} p-6 backdrop-blur transition-transform hover:-translate-y-1`}>
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${t.iconBg}`}>
                <t.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{t.title}</h3>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.subtitle}</p>
              <p className="mt-3 text-sm text-muted-foreground">{t.desc}</p>
            </div>
            {i < terminals.length - 1 && (
              <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-primary md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default MultiTerminalSection;
