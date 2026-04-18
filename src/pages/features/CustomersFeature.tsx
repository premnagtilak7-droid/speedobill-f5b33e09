import FeaturePage from "@/components/landing/FeaturePage";
import { UserCircle, History, Gift, Star } from "lucide-react";

const CustomersFeature = () => (
  <FeaturePage
    eyebrow="Customer Management"
    title="Build Loyal"
    titleAccent="Customer Relationships"
    subtitle="Know your regulars, reward their loyalty, and turn one-time guests into fans for life."
    screenshotLabel="Customer CRM Dashboard"
    mockup="customers"
    features={[
      { icon: UserCircle, title: "Customer Profiles", description: "Capture name, phone, birthday, and dietary preferences automatically." },
      { icon: History, title: "Visit History", description: "Full timeline of orders, spend, and visit frequency for every guest." },
      { icon: Gift, title: "Loyalty Points", description: "Reward visits with configurable points, tiers, and free-item rewards." },
      { icon: Star, title: "Feedback Collection", description: "Capture ratings and comments after every meal to improve service." },
    ]}
  />
);

export default CustomersFeature;
