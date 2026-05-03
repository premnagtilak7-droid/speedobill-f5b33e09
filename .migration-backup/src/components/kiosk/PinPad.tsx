import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Universal PIN pad — large 60x60 (and bigger) tap targets so it works on
 * mobile touch, tablet, and PC mouse alike.
 *
 * Stateless: parent owns the digits string and decides how to handle entry.
 */

interface PinPadProps {
  value: string;
  /** Total digits expected (4 for staff, can be 6 for owner pin etc.) */
  length?: number;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}

const KEYS: (string | "back" | "clear")[] = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  "clear", "0", "back",
];

export const PinPad = ({ value, length = 4, onChange, disabled, className }: PinPadProps) => {
  const handleKey = (k: string) => {
    if (disabled) return;
    if (k === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === "clear") {
      onChange("");
      return;
    }
    if (value.length >= length) return;
    onChange(value + k);
  };

  return (
    <div className={cn("w-full max-w-sm mx-auto select-none", className)}>
      {/* Digit indicators */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <div
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-all",
                filled ? "bg-primary border-primary scale-110" : "border-muted-foreground/40",
              )}
            />
          );
        })}
      </div>

      {/* Keypad — 60x60 minimum, scales up nicely on larger screens */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => {
          const isAction = k === "back" || k === "clear";
          const isClear = k === "clear";
          return (
            <button
              key={k}
              type="button"
              onClick={() => handleKey(k)}
              disabled={disabled}
              className={cn(
                "min-h-[60px] min-w-[60px] h-16 sm:h-20 rounded-2xl text-2xl font-bold",
                "transition-all duration-100 active:scale-95",
                "flex items-center justify-center",
                "border border-border/60 shadow-sm",
                isAction
                  ? isClear
                    ? "bg-muted/50 hover:bg-muted text-muted-foreground"
                    : "bg-muted/50 hover:bg-muted text-foreground"
                  : "bg-card hover:bg-secondary text-foreground",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label={k === "back" ? "Backspace" : k === "clear" ? "Clear" : `Digit ${k}`}
            >
              {k === "back" ? (
                <Delete className="h-6 w-6" />
              ) : k === "clear" ? (
                <span className="text-sm font-semibold">CLEAR</span>
              ) : (
                k
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PinPad;
