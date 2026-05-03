import { QrCode } from "lucide-react";
import AddonPage from "@/components/landing/AddonPage";

const QrPayAddon = () => (
  <AddonPage
    icon={QrCode}
    title="QR Scan & Pay"
    description="Customers scan, pay via UPI and settle their bill in seconds. Zero MDR charges."
    benefits={[
      "Instant UPI payment",
      "Auto bill reconciliation",
      "Works offline",
      "Supports PhonePe / GPay / Paytm",
    ]}
    price="₹99/month"
  />
);

export default QrPayAddon;
