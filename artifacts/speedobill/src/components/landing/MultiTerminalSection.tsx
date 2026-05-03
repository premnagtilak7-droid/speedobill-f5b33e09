const terminals = [
  {
    emoji: "🖥️",
    title: "Master POS",
    desc: "Complete billing from the counter station with full touch and controls.",
  },
  {
    emoji: "📱",
    title: "Waiter Tabs",
    desc: "Staff take orders tableside on any Android phone, synced instantly.",
  },
  {
    emoji: "🍳",
    title: "KOT Display",
    desc: "Live order display for chefs with status, timers and color-coded urgency.",
  },
];

const MultiTerminalSection = () => (
  <section
    className="px-4 py-20 sm:px-6 lg:px-8"
    style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0f172a 100%)" }}
  >
    <div className="mx-auto max-w-6xl">
      <div className="text-center">
        <span
          className="mb-4 inline-block rounded-full px-4 py-1 text-sm font-medium"
          style={{ backgroundColor: "rgba(249, 115, 22, 0.1)", color: "#F97316" }}
        >
          One Platform · Three Devices
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Run your entire restaurant from any device
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Whether at the counter, kitchen or on the go — SpeedoBill works everywhere.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {terminals.map((t) => (
          <div
            key={t.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-orange-500/40"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: "rgba(249, 115, 22, 0.1)" }}>
              {t.emoji}
            </div>
            <h3 className="text-xl font-bold text-white">{t.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default MultiTerminalSection;
