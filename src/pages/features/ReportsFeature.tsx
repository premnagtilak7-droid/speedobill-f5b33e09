import FeaturePage from "@/components/landing/FeaturePage";
import { TrendingUp, PieChart, Award, FileSpreadsheet } from "lucide-react";

const ReportsFeature = () => (
  <FeaturePage
    eyebrow="Reports & Analytics"
    title="Smart Reports for"
    titleAccent="Smarter Decisions"
    subtitle="Know your top sellers, busiest hours, and best staff at a glance — every single day."
    screenshotLabel="Analytics Dashboard"
    features={[
      { icon: TrendingUp, title: "Daily Sales Summary", description: "Revenue, orders, and average bill — auto-updated in real time." },
      { icon: PieChart, title: "Item-wise Profit Report", description: "See which dishes drive profit and which to drop from the menu." },
      { icon: Award, title: "Staff Performance", description: "Orders served, sales generated, and ratings per waiter and chef." },
      { icon: FileSpreadsheet, title: "Export to Excel & PDF", description: "Download any report for your accountant in one click." },
    ]}
  />
);

export default ReportsFeature;
