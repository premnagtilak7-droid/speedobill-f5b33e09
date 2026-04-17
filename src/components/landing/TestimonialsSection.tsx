const TESTIMONIALS = [
  {
    quote: "SpeedoBill reduced our billing time by 70%. Our canteen counter never has a rush anymore.",
    name: "Rajesh Patil",
    role: "Owner @ Sai Canteen",
    location: "Pune",
  },
  {
    quote: "GST reports used to take us 2 hours. Now it's one click. Absolutely love this software.",
    name: "Meena Shah",
    role: "Manager @ Hotel Residency",
    location: "Mumbai",
  },
  {
    quote: "The WhatsApp billing feature is a game changer. Customers love getting digital receipts.",
    name: "Arjun Nair",
    role: "Owner @ Spice Garden",
    location: "Nashik",
  },
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const TestimonialsSection = () => {
  return (
    <section
      id="testimonials"
      className="relative px-4 py-24 sm:px-6 lg:px-8"
      style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0f172a 100%)" }}
      aria-label="Customer testimonials"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            What our customers say
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Real stories from restaurant and hotel owners across India
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-orange-500/40"
            >
              <div className="mb-4 text-lg tracking-wider" style={{ color: "#F97316" }} aria-label="5 out of 5 stars">
                ★★★★★
              </div>

              <p className="flex-1 text-base leading-relaxed text-slate-200">
                "{t.quote}"
              </p>

              <div className="mt-6 flex items-center gap-3 border-t border-white/5 pt-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: "#F97316" }}
                  aria-hidden="true"
                >
                  {getInitials(t.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{t.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {t.role}, {t.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
