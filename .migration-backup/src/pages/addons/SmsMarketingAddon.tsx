import { MessageSquare } from "lucide-react";
import AddonPage from "@/components/landing/AddonPage";

const SmsMarketingAddon = () => (
  <AddonPage
    icon={MessageSquare}
    title="SMS Marketing"
    description="Send offers, festival greetings and reorder reminders directly to your customers."
    benefits={[
      "Bulk SMS campaigns",
      "Festival offer templates",
      "Auto reorder reminders",
      "CRM integration",
    ]}
    price="₹149/month"
  />
);

export default SmsMarketingAddon;
