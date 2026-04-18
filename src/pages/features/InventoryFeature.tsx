import FeaturePage from "@/components/landing/FeaturePage";
import { Bell, ChefHat, Truck, Trash2 } from "lucide-react";

const InventoryFeature = () => (
  <FeaturePage
    eyebrow="Inventory & Stock"
    title="Never Run Out of"
    titleAccent="Stock Again"
    subtitle="Real-time stock tracking, recipe auto-deduction, and instant low-stock alerts on your phone."
    screenshotLabel="Inventory Dashboard"
    features={[
      { icon: Bell, title: "Live Low-Stock Alerts", description: "Push notifications the moment any ingredient hits its threshold." },
      { icon: ChefHat, title: "Recipe Auto-Deduction", description: "Sell a dish — ingredients deduct automatically based on the recipe." },
      { icon: Truck, title: "Vendor & Purchase Logs", description: "Track every purchase with vendor, quantity, and unit price history." },
      { icon: Trash2, title: "Wastage Tracking", description: "Log spoilage and waste with reasons to find leakage points." },
    ]}
  />
);

export default InventoryFeature;
