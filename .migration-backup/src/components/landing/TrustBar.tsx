const BUSINESSES = [
  "Hotel Sai Palace",
  "Spice Garden",
  "Cafe Mocha",
  "Hotel Residency",
  "The Grand Buffet",
  "Mumbai Canteen",
  "Pune Eats",
  "Raj Restaurant",
  "Hotel Sunrise",
  "Bite & Brew",
];

const TrustBar = () => {
  // Duplicate the list so the marquee loops seamlessly
  const loop = [...BUSINESSES, ...BUSINESSES];

  return (
    <section
      className="relative overflow-hidden border-y border-white/5 py-12"
      style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0f172a 100%)" }}
      aria-label="Trusted businesses"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
          Trusted by{" "}
          <span style={{ color: "#F97316" }} className="font-semibold">
            500+ businesses
          </span>{" "}
          across Maharashtra
        </p>
      </div>

      {/* Marquee */}
      <div className="relative mt-8">
        {/* Edge fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0a0e1a] to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0f172a] to-transparent sm:w-32" />

        <div className="flex w-max animate-marquee gap-4 pr-4">
          {loop.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 backdrop-blur-sm transition-colors hover:border-orange-500/40 hover:bg-orange-500/5"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "#F97316" }}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap text-sm font-medium text-slate-200">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
