import { Check, X } from "lucide-react";

type Cell = boolean | string;

const COLUMNS = ["SpeedoBill", "Petpooja", "Generic POS"] as const;

const ROWS: { feature: string; values: [Cell, Cell, Cell] }[] = [
  { feature: "GST Billing", values: [true, true, true] },
  { feature: "WhatsApp Receipts", values: [true, false, false] },
  { feature: "Offline Mode", values: [true, true, false] },
  { feature: "Free Plan Available", values: [true, false, false] },
  { feature: "Starting Price", values: ["₹0/month", "₹999/month", "₹500/month"] },
  { feature: "Setup Time", values: ["10 mins", "1-2 days", "3-5 days"] },
  { feature: "24/7 Support", values: [true, true, false] },
  { feature: "Multi-device", values: [true, true, false] },
];

const renderCell = (val: Cell, isSpeedo: boolean) => {
  if (typeof val === "boolean") {
    return val ? (
      <Check
        className="mx-auto h-5 w-5"
        style={{ color: "#F97316" }}
        strokeWidth={3}
        aria-label="Yes"
      />
    ) : (
      <X className="mx-auto h-5 w-5 text-slate-600" strokeWidth={2.5} aria-label="No" />
    );
  }
  return (
    <span className={isSpeedo ? "font-bold text-white" : "text-slate-300"}>{val}</span>
  );
};

const ComparisonSection = () => {
  return (
    <section
      className="px-4 py-24 sm:px-6 lg:px-8"
      style={{ background: "linear-gradient(180deg, #0f172a 0%, #0a0e1a 100%)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Why SpeedoBill beats the rest
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            See how we compare to other POS solutions in India
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-5 text-sm font-semibold uppercase tracking-wide text-slate-400 sm:px-6">
                    Feature
                  </th>
                  {COLUMNS.map((col) => {
                    const isSpeedo = col === "SpeedoBill";
                    return (
                      <th
                        key={col}
                        className="px-4 py-5 text-center text-sm font-bold uppercase tracking-wide sm:px-6"
                        style={
                          isSpeedo
                            ? {
                                color: "#F97316",
                                borderLeft: "2px solid #F97316",
                                borderRight: "2px solid #F97316",
                                backgroundColor: "rgba(249, 115, 22, 0.08)",
                              }
                            : { color: "rgb(148, 163, 184)" }
                        }
                      >
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, rowIdx) => {
                  const isLast = rowIdx === ROWS.length - 1;
                  return (
                    <tr
                      key={row.feature}
                      className={isLast ? "" : "border-b border-slate-800/70"}
                    >
                      <td className="px-4 py-4 text-sm font-medium text-slate-200 sm:px-6 sm:text-base">
                        {row.feature}
                      </td>
                      {row.values.map((val, i) => {
                        const isSpeedo = i === 0;
                        return (
                          <td
                            key={i}
                            className="px-4 py-4 text-center text-sm sm:px-6 sm:text-base"
                            style={
                              isSpeedo
                                ? {
                                    borderLeft: "2px solid #F97316",
                                    borderRight: "2px solid #F97316",
                                    backgroundColor: "rgba(249, 115, 22, 0.06)",
                                    ...(isLast
                                      ? { borderBottom: "2px solid #F97316" }
                                      : {}),
                                  }
                                : undefined
                            }
                          >
                            {renderCell(val, isSpeedo)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Comparison based on publicly available information as of 2026. Features may vary.
        </p>
      </div>
    </section>
  );
};

export default ComparisonSection;
