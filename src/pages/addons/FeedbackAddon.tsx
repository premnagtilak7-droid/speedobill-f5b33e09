import { Star } from "lucide-react";
import AddonPage from "@/components/landing/AddonPage";

const FeedbackAddon = () => (
  <AddonPage
    icon={Star}
    title="Customer Feedback System"
    description="Capture star ratings and reviews automatically after every meal."
    benefits={[
      "Auto feedback request via WhatsApp",
      "Star rating system",
      "Review analytics dashboard",
      "Google review redirect",
    ]}
    price="₹99/month"
  />
);

export default FeedbackAddon;
