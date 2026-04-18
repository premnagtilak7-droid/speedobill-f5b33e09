import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Small, subtle "Back to Website" button for desktop users inside the app.
 * Hidden on mobile (< 768px). Fixed at top-left corner.
 */
const BackToWebsiteButton = () => {
  return (
    <Link
      to="/"
      aria-label="Back to website"
      className="fixed left-3 top-3 z-[60] hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 hover:text-orange-400 md:inline-flex"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Website
    </Link>
  );
};

export default BackToWebsiteButton;
