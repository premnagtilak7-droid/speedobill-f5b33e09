import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const LandingFooter = () => (
  <footer className="border-t border-border/40 bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-white">Speedo Bill</span>
      </div>

      {/* Links */}
      <div className="flex flex-wrap justify-center gap-6 text-sm">
        <Link to="/about" className="text-slate-400 transition-colors hover:text-white">About</Link>
        <Link to="/privacy" className="text-slate-400 transition-colors hover:text-white">Privacy Policy</Link>
        <Link to="/terms" className="text-slate-400 transition-colors hover:text-white">Terms & Conditions</Link>
        <Link to="/support" className="text-slate-400 transition-colors hover:text-white">Support</Link>
      </div>

      {/* Copyright */}
      <p className="text-center text-xs text-slate-500">
        © 2026 SpeedoBill. All rights reserved.
      </p>
    </div>
  </footer>
);

export default LandingFooter;
