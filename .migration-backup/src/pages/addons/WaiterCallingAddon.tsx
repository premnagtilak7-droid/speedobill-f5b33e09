import { Bell } from "lucide-react";
import AddonPage from "@/components/landing/AddonPage";

const WaiterCallingAddon = () => (
  <AddonPage
    icon={Bell}
    title="Waiter Calling System"
    description="Guests tap a QR button on the table to instantly notify your staff. No app download needed."
    benefits={[
      "Reduce wait time",
      "Improve guest satisfaction",
      "Works on any device",
      "Real-time notifications",
    ]}
    price="₹99/month"
  />
);

export default WaiterCallingAddon;
