import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface DayHours { open: string; close: string; closed: boolean; }
export type OperatingHours = Record<DayKey, DayHours>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const DEFAULT_HOURS: OperatingHours = {
  mon: { open: "09:00", close: "22:00", closed: false },
  tue: { open: "09:00", close: "22:00", closed: false },
  wed: { open: "09:00", close: "22:00", closed: false },
  thu: { open: "09:00", close: "22:00", closed: false },
  fri: { open: "09:00", close: "22:00", closed: false },
  sat: { open: "09:00", close: "22:00", closed: false },
  sun: { open: "09:00", close: "22:00", closed: true },
};

interface Props {
  value: OperatingHours;
  onChange: (next: OperatingHours) => void;
}

const OperatingHoursEditor = ({ value, onChange }: Props) => {
  const update = (key: DayKey, patch: Partial<DayHours>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const day = value[key] || DEFAULT_HOURS[key];
        return (
          <div key={key} className="grid grid-cols-[60px_1fr_auto] md:grid-cols-[80px_1fr_1fr_auto] items-center gap-2 rounded-md border border-border/60 p-2">
            <span className="text-sm font-medium">{label}</span>
            <Input
              type="time"
              value={day.open}
              disabled={day.closed}
              onChange={(e) => update(key, { open: e.target.value })}
              className="h-9"
              aria-label={`${label} open time`}
            />
            <Input
              type="time"
              value={day.close}
              disabled={day.closed}
              onChange={(e) => update(key, { close: e.target.value })}
              className="h-9 hidden md:block"
              aria-label={`${label} close time`}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{day.closed ? "Closed" : "Open"}</span>
              <Switch checked={!day.closed} onCheckedChange={(checked) => update(key, { closed: !checked })} />
            </div>
            <Input
              type="time"
              value={day.close}
              disabled={day.closed}
              onChange={(e) => update(key, { close: e.target.value })}
              className="h-9 col-span-3 md:hidden"
              aria-label={`${label} close time mobile`}
            />
          </div>
        );
      })}
    </div>
  );
};

export default OperatingHoursEditor;
