import FeaturePage from "@/components/landing/FeaturePage";
import { Receipt, MessageSquare, Printer, Wallet, RotateCcw } from "lucide-react";

const BillingFeature = () => (
  <FeaturePage
    eyebrow="Billing & POS"
    title="Lightning Fast"
    titleAccent="GST Billing"
    subtitle="Print thermal receipts, send WhatsApp bills, and accept split payments — all in seconds."
    screenshotLabel="Counter Billing Screen"
    mockup="billing"
    features={[
      { icon: Receipt, title: "GST Auto-Calculation", description: "5% GST applied automatically on every bill — no manual math." },
      { icon: MessageSquare, title: "WhatsApp Receipts", description: "Send digital bills directly to customer WhatsApp instantly." },
      { icon: Printer, title: "Thermal Printer Support", description: "Crisp 58mm/80mm receipts with one tap." },
      { icon: Wallet, title: "Split Payments", description: "Accept Cash, UPI, and Card together on a single bill." },
      { icon: RotateCcw, title: "Reprint & Void Controls", description: "Owner-approved reprints and easy item void with audit logs." },
    ]}
  />
);

export default BillingFeature;
