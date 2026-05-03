import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingFooter from "@/components/landing/LandingFooter";
import DashboardMockup, { type MockupVariant } from "@/components/landing/DashboardMockup";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

interface FeaturePageProps {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  features: FeatureItem[];
  screenshotLabel: string;
  mockup?: MockupVariant;
}

const FeaturePage = ({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  features,
  screenshotLabel,
  mockup = "generic",
}: FeaturePageProps) => {
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
        <a href="/#demo">
          <Button size="sm" className="font-semibold">Book a Free Demo</Button>
        </a>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-orange-400"
            style={{ backgroundColor: "rgba(249, 115, 22, 0.1)", border: "1px solid rgba(249, 115, 22, 0.3)" }}
          >
            {eyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title} {titleAccent && <span className="text-orange-500">{titleAccent}</span>}
          </h1>
          <p className="mt-6 text-lg text-slate-400 sm:text-xl">{subtitle}</p>
        </div>
      </section>

      {/* Features grid */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 transition-all hover:-translate-y-1"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(249, 115, 22, 0.12)" }}
              >
                <f.icon className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-white">{f.title}</h3>
              {f.description && <p className="mt-2 text-sm text-slate-400">{f.description}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard mockup */}
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <DashboardMockup variant={mockup} label={screenshotLabel} />
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
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            No credit card required · 7-day free trial · Cancel anytime
          </p>
          <a href="/#demo" className="mt-8 inline-block">
            <Button size="lg" className="font-semibold">Book a Free Demo</Button>
          </a>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default FeaturePage;
