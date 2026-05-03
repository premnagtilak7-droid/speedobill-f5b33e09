import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Wallet,
  CreditCard,
  Banknote,
  Users,
  Calendar,
  Award,
} from "lucide-react";

export type MockupVariant =
  | "inventory"
  | "billing"
  | "reports"
  | "payroll"
  | "customers"
  | "generic";

const cardStyle = {
  backgroundColor: "#0f1629",
  border: "1px solid #1e2a45",
};

const Frame = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div
    className="relative overflow-hidden rounded-3xl p-1 sm:p-1.5"
    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.4), rgba(249,115,22,0.05))" }}
  >
    <div
      className="rounded-[1.4rem] p-5 sm:p-8"
      style={cardStyle}
      role="img"
      aria-label={label}
    >
      {children}
    </div>
  </div>
);

/* ---------- Inventory ---------- */
const InventoryMockup = () => {
  const rows = [
    { name: "Tomatoes", qty: "2 kg remaining", status: "low" },
    { name: "Rice", qty: "15 kg", status: "ok" },
    { name: "Oil", qty: "5 L", status: "ok" },
  ];
  const bars = [60, 85, 40, 95, 70, 55, 80];
  return (
    <Frame label="Inventory dashboard preview">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-white sm:text-lg">Inventory</h4>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: "#F97316" }}
        >
          <Plus className="h-3.5 w-3.5" /> Add Item
        </button>
      </div>

      <div className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
          >
            <div>
              <p className="text-sm font-semibold text-white">{r.name}</p>
              <p className="text-xs text-slate-400">{r.qty}</p>
            </div>
            {r.status === "low" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <AlertTriangle className="h-3 w-3" /> Low Stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <CheckCircle2 className="h-3 w-3" /> OK
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Weekly Usage</p>
          <p className="text-xs text-orange-400">+12%</p>
        </div>
        <div className="flex h-24 items-end gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md"
              style={{
                height: `${h}%`,
                background: `linear-gradient(180deg, rgba(249,115,22,0.9), rgba(249,115,22,0.3))`,
              }}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
};

/* ---------- Billing ---------- */
const BillingMockup = () => {
  const items = [
    { name: "Butter Chicken", qty: 2, price: 340 },
    { name: "Naan", qty: 4, price: 120 },
    { name: "Lassi", qty: 2, price: 90 },
  ];
  return (
    <Frame label="Billing dashboard preview">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bill</p>
          <h4 className="text-lg font-bold text-white">#1248</h4>
        </div>
        <Receipt className="h-6 w-6 text-orange-500" />
      </div>

      <div className="mt-5 space-y-2.5">
        {items.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
          >
            <div>
              <p className="text-sm font-semibold text-white">{it.name}</p>
              <p className="text-xs text-slate-400">x{it.qty}</p>
            </div>
            <p className="text-sm font-semibold text-white">₹{it.price}</p>
          </div>
        ))}
      </div>

      <div
        className="mt-4 flex items-center justify-between rounded-xl p-4"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.04))", border: "1px solid rgba(249,115,22,0.3)" }}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">Total</span>
        <span className="text-2xl font-bold text-orange-500">₹550</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Cash", icon: Banknote },
          { label: "UPI", icon: Wallet },
          { label: "Card", icon: CreditCard },
        ].map((p, i) => (
          <button
            key={p.label}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold"
            style={
              i === 1
                ? { backgroundColor: "#F97316", color: "white" }
                : { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid #1e2a45", color: "#cbd5e1" }
            }
          >
            <p.icon className="h-3.5 w-3.5" /> {p.label}
          </button>
        ))}
      </div>
    </Frame>
  );
};

/* ---------- Reports ---------- */
const ReportsMockup = () => {
  // Upward line chart points (svg viewBox 100x40)
  const points = "0,32 14,28 28,30 42,22 56,18 70,14 84,10 100,4";
  return (
    <Frame label="Reports dashboard preview">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's Sales</p>
          <h4 className="text-3xl font-bold text-orange-500 sm:text-4xl">₹12,450</h4>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-emerald-400" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <TrendingUp className="h-3.5 w-3.5" /> +18%
        </span>
      </div>

      <div className="mt-5 rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-24 w-full">
          <defs>
            <linearGradient id="rpt-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline
            points={points}
            fill="none"
            stroke="#F97316"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points={`${points} 100,40 0,40`} fill="url(#rpt-grad)" />
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Orders", value: "84" },
          { label: "Avg Bill", value: "₹148" },
          { label: "Top Item", value: "Butter Chicken" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-2.5 text-center"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
};

/* ---------- Payroll ---------- */
const PayrollMockup = () => {
  const staff = [
    { name: "Ravi", present: true },
    { name: "Sunita", present: true },
    { name: "Mohan", present: false },
  ];
  return (
    <Frame label="Staff dashboard preview">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h4 className="text-base font-bold text-white sm:text-lg">Today's Roster</h4>
        </div>
        <span className="text-xs text-slate-400">3 staff</span>
      </div>

      <div className="mt-5 space-y-2.5">
        {staff.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: "rgba(249,115,22,0.18)", color: "#F97316" }}
              >
                {s.name[0]}
              </div>
              <p className="text-sm font-semibold text-white">{s.name}</p>
            </div>
            {s.present ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <CheckCircle2 className="h-3 w-3" /> Present
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-400" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                Absent
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-orange-500" /> Shift
          </div>
          <p className="mt-1 text-sm font-bold text-white">Morning · 9AM–5PM</p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.04))", border: "1px solid rgba(249,115,22,0.3)" }}
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Award className="h-3.5 w-3.5 text-orange-500" /> Salary Due
          </div>
          <p className="mt-1 text-sm font-bold text-orange-500">₹8,500</p>
        </div>
      </div>
    </Frame>
  );
};

/* ---------- Customers ---------- */
const CustomersMockup = () => {
  const customers = [
    { name: "Priya Sharma", visits: 12, points: 240, tier: "Gold" },
    { name: "Arjun Mehta", visits: 8, points: 160, tier: "Silver" },
    { name: "Neha Patel", visits: 24, points: 480, tier: "Gold" },
  ];
  return (
    <Frame label="Customer CRM preview">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h4 className="text-base font-bold text-white sm:text-lg">Loyal Customers</h4>
        </div>
        <span className="text-xs text-orange-400">★ 4.8 avg</span>
      </div>

      <div className="mt-5 space-y-2.5">
        {customers.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #1e2a45" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "rgba(249,115,22,0.18)", color: "#F97316" }}
              >
                {c.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{c.name}</p>
                <p className="text-xs text-slate-400">{c.visits} visits</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-orange-500">{c.points} pts</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{c.tier}</p>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
};

/* ---------- Generic ---------- */
const GenericMockup = ({ label }: { label: string }) => (
  <Frame label={`${label} preview`}>
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 -z-10 blur-2xl"
          style={{ backgroundColor: "rgba(249,115,22,0.5)" }}
        />
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #F97316, #ea580c)" }}
        >
          SB
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">SpeedoBill</p>
      <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">{label}</h3>
      <div className="mt-6 w-full max-w-xs space-y-2">
        {[100, 75, 55].map((w, i) => (
          <div
            key={i}
            className="h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${w}%`,
                background: "linear-gradient(90deg, #F97316, rgba(249,115,22,0.4))",
                animation: `pulse 2s ${i * 0.3}s ease-in-out infinite`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

interface Props {
  variant: MockupVariant;
  label: string;
}

const DashboardMockup = ({ variant, label }: Props) => {
  switch (variant) {
    case "inventory":
      return <InventoryMockup />;
    case "billing":
      return <BillingMockup />;
    case "reports":
      return <ReportsMockup />;
    case "payroll":
      return <PayrollMockup />;
    case "customers":
      return <CustomersMockup />;
    default:
      return <GenericMockup label={label} />;
  }
};

export default DashboardMockup;
