import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  location: string;
};

const TESTIMONIALS: Testimonial[] = [
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            What our customers say
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Real stories from restaurant and hotel owners across India
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
              className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:bg-white/[0.05] hover:shadow-[0_10px_40px_-10px_rgba(249,115,22,0.25)]"
            >
              <Quote
                className="absolute right-5 top-5 h-8 w-8 opacity-10 transition-opacity group-hover:opacity-30"
                style={{ color: "#F97316" }}
                aria-hidden="true"
              />

              <div className="mb-4 flex gap-1" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className="h-4 w-4"
                    style={{ color: "#F97316", fill: "#F97316" }}
                  />
                ))}
              </div>

              <p className="flex-1 text-base leading-relaxed text-slate-200">
                "{t.quote}"
              </p>

              <div className="mt-6 flex items-center gap-3 border-t border-white/5 pt-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, #F97316 0%, #ea580c 100%)",
                  }}
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
