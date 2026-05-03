import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Globe, Clock, Instagram, Facebook, MessageCircle, Building2, Package, Star, Flag } from "lucide-react";
import { useEffect } from "react";

const stats = [
  { icon: Building2, value: "28+", label: "Hotels using SpeedoBill" },
  { icon: Package, value: "10,000+", label: "Orders processed" },
  { icon: Star, value: "Trusted", label: "by restaurant owners" },
  { icon: Flag, value: "🇮🇳 Made", label: "in India" },
];

export default function AboutPage() {
  useEffect(() => {
    document.title = "About SpeedoBill — Smart Restaurant Management for India";
    const meta = document.querySelector('meta[name="description"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'description' }));
    meta.setAttribute('content', "SpeedoBill is professional restaurant billing & management software made in India. Trusted by 28+ hotels — from small dhabas to large restaurants.");
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1629] via-[#10182c] to-[#0b1120] text-white">


      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0f1629]/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <span className="text-orange-400 font-bold tracking-wide">SpeedoBill</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.15),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30 mb-4">
            About Us
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            About <span className="text-orange-500">SpeedoBill</span>
          </h1>
          <p className="mt-4 text-lg md:text-2xl text-white/70 max-w-3xl mx-auto">
            Smart Restaurant Management for Every Indian Restaurant
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-6 text-orange-400">Our Story</h2>
        <div className="space-y-5 text-white/80 leading-relaxed text-lg">
          <p>
            SpeedoBill was born from a simple idea: <span className="text-white font-semibold">every restaurant in India deserves professional billing software.</span>
          </p>
          <p>
            We built SpeedoBill to help hotel owners, restaurant managers, and their staff work smarter, serve faster, and grow their business.
          </p>
          <p>
            From small dhabas to large restaurants — <span className="text-orange-400 font-semibold">SpeedoBill works for everyone.</span>
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-8 md:p-10 bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/30 backdrop-blur-xl">
          <h2 className="text-2xl md:text-3xl font-bold text-orange-400 mb-3">Our Mission</h2>
          <p className="text-xl md:text-2xl text-white leading-snug">
            To digitize every Indian restaurant with affordable, easy-to-use technology.
          </p>
        </Card>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-3xl font-bold mb-8 text-center">Trusted Across India</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <Card key={i} className="p-6 bg-white/5 border-white/10 backdrop-blur-xl text-center hover:border-orange-500/40 transition">
              <s.icon className="w-8 h-8 mx-auto text-orange-400 mb-3" />
              <div className="text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-sm text-white/60 mt-1">{s.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <Card className="p-8 bg-white/5 border-white/10 backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-orange-400 mb-6">Contact Us</h2>
          <div className="space-y-4 text-white/85">
            <a href="mailto:speedobill7@gmail.com" className="flex items-center gap-3 hover:text-orange-400">
              <Mail className="w-5 h-5 text-orange-400" />
              <span>speedobill7@gmail.com</span>
            </a>
            <a href="https://speedobill.in" className="flex items-center gap-3 hover:text-orange-400">
              <Globe className="w-5 h-5 text-orange-400" />
              <span>speedobill.in</span>
            </a>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-400" />
              <span>Support: 9 AM – 9 PM IST</span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Follow Us</h3>
            <div className="flex flex-wrap gap-3">
              <a href="https://instagram.com/speedobill" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/20 hover:bg-orange-500/15 hover:border-orange-500/40">
                  <Instagram className="w-4 h-4 mr-2" /> Instagram
                </Button>
              </a>
              <a href="https://facebook.com/speedobill" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/20 hover:bg-orange-500/15 hover:border-orange-500/40">
                  <Facebook className="w-4 h-4 mr-2" /> Facebook
                </Button>
              </a>
              <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/20 hover:bg-orange-500/15 hover:border-orange-500/40">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to digitize your restaurant?</h2>
        <p className="text-white/70 mb-6">Join 28+ hotels already running smarter with SpeedoBill.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/pricing">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">View Pricing</Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" className="border-orange-500/40 text-orange-300 hover:bg-orange-500/15">Get Started</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-white/50 text-sm">
        © {new Date().getFullYear()} SpeedoBill. Made with ❤️ in India.
      </footer>
    </div>
  );
}
