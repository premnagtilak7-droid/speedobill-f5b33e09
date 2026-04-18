import { Link } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingFooter from "@/components/landing/LandingFooter";

interface AddonPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
  price: string;
}

const AddonPage = ({ icon: Icon, title, description, benefits, price }: AddonPageProps) => {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0f172a 100%)" }}>
      {/* Top bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-orange-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <Link to="/auth">
          <Button size="sm" className="font-semibold">Add to My Plan</Button>
        </Link>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: "rgba(249, 115, 22, 0.12)",
              border: "1px solid rgba(249, 115, 22, 0.3)",
            }}
          >
            <Icon className="h-8 w-8 text-orange-500" />
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-orange-400"
            style={{ backgroundColor: "rgba(249, 115, 22, 0.1)", border: "1px solid rgba(249, 115, 22, 0.3)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Add-on: {price}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 text-lg text-slate-400 sm:text-xl">{description}</p>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
          Key benefits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="flex items-start gap-4 rounded-2xl p-5"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgba(249, 115, 22, 0.12)" }}
              >
                <Check className="h-5 w-5 text-orange-500" />
              </div>
              <p className="pt-1 text-base font-medium text-white">{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl p-10 text-center sm:p-14"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.02))",
            border: "1px solid rgba(249, 115, 22, 0.3)",
          }}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-400">
            {price}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Ready to power up your business?
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Activate this add-on instantly from your dashboard.
          </p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button size="lg" className="font-semibold">Add to My Plan</Button>
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default AddonPage;
