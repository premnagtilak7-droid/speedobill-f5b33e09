import FeaturePage from "@/components/landing/FeaturePage";
import { Clock, CalendarDays, Wallet, PalmtreeIcon } from "lucide-react";

const PayrollFeature = () => (
  <FeaturePage
    eyebrow="Staff & Payroll"
    title="Manage Your Staff"
    titleAccent="With Ease"
    subtitle="Attendance, shifts, salaries, and leaves — all in one place. Pay accurately, on time, every time."
    screenshotLabel="Staff Management Panel"
    features={[
      { icon: Clock, title: "Attendance Tracking", description: "Clock-in/clock-out logs with PIN authentication for every staff member." },
      { icon: CalendarDays, title: "Shift Management", description: "Schedule morning, evening, and night shifts with smart conflict alerts." },
      { icon: Wallet, title: "Salary Calculation", description: "Auto-compute base, bonus, deductions, and advance — ready to pay." },
      { icon: PalmtreeIcon, title: "Leave Management", description: "Approve or reject leave requests with full history per employee." },
    ]}
  />
);

export default PayrollFeature;
