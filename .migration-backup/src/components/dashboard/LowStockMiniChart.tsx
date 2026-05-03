// Small inline bar chart for top 5 low-stock ingredients.
// Color rules:
//   Critical (current <= 25% of min) → destructive
//   Low      (current <= min)        → warning
//   OK                                → success

interface Item {
  name: string;
  current_stock: number;
  min_threshold: number;
  unit?: string;
}

interface Props {
  items: Item[];
}

const LowStockMiniChart = ({ items }: Props) => {
  if (!items || items.length === 0) return null;

  const top = [...items]
    .sort((a, b) => {
      const ra = a.min_threshold > 0 ? a.current_stock / a.min_threshold : 1;
      const rb = b.min_threshold > 0 ? b.current_stock / b.min_threshold : 1;
      return ra - rb;
    })
    .slice(0, 5);

  return (
    <div className="mt-3 space-y-2">
      {top.map((it) => {
        const min = Math.max(1, it.min_threshold);
        const pct = Math.min(100, Math.max(4, Math.round((it.current_stock / min) * 100)));
        const ratio = it.current_stock / min;
        const tone =
          ratio <= 0.25
            ? { bar: "bg-destructive", text: "text-destructive" }
            : ratio <= 1
            ? { bar: "bg-warning", text: "text-warning" }
            : { bar: "bg-success", text: "text-success" };

        return (
          <div key={it.name} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground truncate max-w-[60%]" title={it.name}>
                {it.name}
              </span>
              <span className={`font-mono tnum ${tone.text}`}>
                {it.current_stock}/{it.min_threshold}
                {it.unit ? ` ${it.unit}` : ""}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${tone.bar} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LowStockMiniChart;
