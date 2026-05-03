const STEPS = [
  {
    number: 1,
    icon: "📱",
    title: "Sign Up Free",
    desc: "Create your account in 30 seconds. No credit card needed.",
  },
  {
    number: 2,
    icon: "⚙️",
    title: "Set Up Your Menu",
    desc: "Add your items, prices, and tax settings in minutes.",
  },
  {
    number: 3,
    icon: "🚀",
    title: "Start Billing",
    desc: "Go live instantly and start accepting orders and payments.",
  },
];

const HowItWorksSection = () => {
  return (
    <section
      className="px-4 py-24 sm:px-6 lg:px-8"
      style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0f172a 100%)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Get started in 3 simple steps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            No technical knowledge needed. Be live in under 10 minutes.
          </p>
        </div>

        <div className="relative mt-16">
          {/* Dotted connector line — desktop only */}
          <div
            aria-hidden="true"
            className="absolute left-[16.66%] right-[16.66%] top-9 hidden border-t-2 border-dotted lg:block"
            style={{ borderColor: "rgba(249, 115, 22, 0.35)" }}
          />

          <div className="relative grid gap-12 lg:grid-cols-3 lg:gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="flex flex-col items-center text-center">
                {/* Numbered orange badge */}
                <div
                  className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full text-2xl font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.4)] ring-4 ring-[#0a0e1a]"
                  style={{ backgroundColor: "#F97316" }}
                >
                  {s.number}
                </div>

                {/* Icon */}
                <div className="mt-6 text-5xl" aria-hidden="true">
                  {s.icon}
                </div>

                {/* Title */}
                <h3 className="mt-4 text-xl font-bold text-white sm:text-2xl">
                  {s.title}
                </h3>

                {/* Description */}
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400 sm:text-base">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
