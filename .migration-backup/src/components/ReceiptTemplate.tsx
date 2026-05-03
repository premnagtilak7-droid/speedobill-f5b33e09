/**
 * ReceiptTemplate
 *
 * A standalone presentational component used to render a thermal receipt
 * preview anywhere in the app (e.g. settle dialog, history sheet). The
 * actual printing is delegated to `printReceipt()` in `lib/print-receipt`,
 * which adaptively picks PC silent print vs mobile Bluetooth.
 *
 * Use this as the visual mirror of what gets printed.
 */

import { Button } from "@/components/ui/button";
import { Printer, Share2 } from "lucide-react";
import { printReceipt } from "@/lib/print-receipt";

interface ReceiptTemplateProps {
  /** Pre-formatted receipt text (monospace-friendly) */
  text: string;
  title?: string;
  logoUrl?: string;
  upiQrUrl?: string;
  upiAmount?: number;
  /** Hide action buttons (e.g. when used inside a print iframe) */
  readOnly?: boolean;
  className?: string;
}

export const ReceiptTemplate = ({
  text,
  title,
  logoUrl,
  upiQrUrl,
  upiAmount,
  readOnly,
  className,
}: ReceiptTemplateProps) => {
  const handlePrint = () => {
    void printReceipt({ text, title, logoUrl, upiQrUrl, upiAmount });
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: title || "Receipt", text });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch {}
    }
  };

  return (
    <div className={className}>
      <div
        className="mx-auto w-[300px] max-w-full rounded-lg border border-border bg-white p-3 text-black shadow-sm"
        style={{ fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.5 }}
      >
        {logoUrl && (
          <div className="text-center mb-2">
            <img src={logoUrl} alt="logo" className="mx-auto max-h-14" />
          </div>
        )}
        <pre className="whitespace-pre-wrap break-words m-0">{text}</pre>
        {upiQrUrl && (
          <div className="text-center mt-2 border-t border-dashed border-black pt-2">
            <img src={upiQrUrl} alt="UPI QR" className="w-32 h-32 mx-auto block" />
            <p className="text-[10px] my-1">
              Scan to Pay
              {typeof upiAmount === "number" ? ` ₹${upiAmount.toFixed(2)}` : ""}
            </p>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex justify-center gap-2 mt-3">
          <Button size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReceiptTemplate;
