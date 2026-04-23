/**
 * Adaptive thermal receipt printing for SpeedoBill.
 *
 * - On PC / desktop browsers: opens a hidden popup formatted for a 300px
 *   80mm thermal printer (Courier New 12px) and triggers window.print()
 *   silently. If the user has set their default printer to the thermal
 *   printer, modern browsers will use it automatically.
 *
 * - On Mobile (PWA / Capacitor / mobile web): if the Capacitor BluetoothLe
 *   plugin is detected, it will be used to send raw text to a paired BT
 *   thermal printer. Otherwise it falls back to Web Share / a print popup
 *   so the user can use their phone's native share sheet.
 */

import { isMobileViewport } from "@/lib/platform";
import { toast } from "sonner";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface PrintOptions {
  /** Plain receipt text (already formatted, monospace-friendly) */
  text: string;
  /** Optional title shown on the print dialog tab */
  title?: string;
  /** Optional logo URL — rendered above the receipt */
  logoUrl?: string;
  /** Optional UPI QR image URL — rendered below the receipt */
  upiQrUrl?: string;
  /** Optional UPI amount line for the QR caption */
  upiAmount?: number;
}

/**
 * Detects whether we're running inside a Capacitor native shell.
 * Stays runtime-safe even if @capacitor/core isn't installed yet.
 */
const isCapacitorNative = (): boolean => {
  try {
    // @ts-ignore - Capacitor global is only present in native builds
    return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

/**
 * Bluetooth thermal printer mock.
 * In production (Capacitor build), wire this to @capacitor-community/bluetooth-le
 * or capacitor-thermal-printer. For now we simulate the flow so the UI is
 * functional and ready.
 */
const printViaBluetooth = async (text: string, title?: string): Promise<boolean> => {
  // Capacitor-ready hook — when the plugin is available, use it.
  try {
    // @ts-ignore - dynamic check, no compile-time dependency
    const ble = (window as any).BluetoothPrinter;
    if (ble && typeof ble.print === "function") {
      await ble.print({ text });
      toast.success(`Sent to Bluetooth printer${title ? ` · ${title}` : ""}`);
      return true;
    }
  } catch (err) {
    console.warn("[print] Bluetooth plugin error:", err);
  }

  // No plugin available → mock mode
  toast.info(
    "Bluetooth printing ready (mock). Pair your thermal printer via the Capacitor build to enable.",
    { duration: 5000 },
  );
  return false;
};

/**
 * Web Share fallback so mobile users can at least send the receipt to their
 * paired printer app, WhatsApp, or Files.
 */
const shareReceipt = async (text: string, title?: string): Promise<boolean> => {
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title: title || "Receipt", text });
      return true;
    }
  } catch {
    // user cancelled or share unavailable
  }
  return false;
};

/**
 * Standard popup-based silent print for desktop / PC.
 * Uses Courier New 12px on a 300px wide canvas — the 80mm thermal standard.
 */
const printViaPopup = ({ text, title, logoUrl, upiQrUrl, upiAmount }: PrintOptions): boolean => {
  const popup = window.open("", "_blank", "width=380,height=800");
  if (!popup) {
    toast.error("Popup blocked. Allow popups to print receipts.");
    return false;
  }

  const safeText = escapeHtml(text);
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:8px"><img src="${escapeHtml(
        logoUrl,
      )}" style="max-width:120px;max-height:60px" /></div>`
    : "";

  const qrCaption =
    typeof upiAmount === "number"
      ? `<p style="font-size:10px;margin:4px 0">Scan to Pay ₹${upiAmount.toFixed(2)}</p>`
      : `<p style="font-size:10px;margin:4px 0">Scan to Pay</p>`;

  const upiHtml = upiQrUrl
    ? `<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:8px">
         <img src="${escapeHtml(upiQrUrl)}" style="width:130px;height:130px;margin:0 auto;display:block" />
         ${qrCaption}
       </div>`
    : "";

  popup.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title || "Receipt")}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body { font-family: 'Courier New', monospace; padding: 0; margin: 0; font-size: 12px; color: #000; }
    .receipt { width: 300px; margin: 0 auto; padding: 12px; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; line-height: 1.5; }
    @media print { body { margin: 0; } button { display: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    ${logoHtml}
    <pre>${safeText}</pre>
    ${upiHtml}
  </div>
  <script>
    window.onload = function() {
      window.focus();
      // Slight delay so images render before print
      setTimeout(function(){ window.print(); }, 250);
    };
  </script>
</body>
</html>`);
  popup.document.close();
  return true;
};

/**
 * Universal print entry point.
 * Picks the right transport for the current device.
 */
export const printReceipt = async (opts: PrintOptions): Promise<void> => {
  // Mobile / Capacitor → try Bluetooth (mock if unavailable) then Web Share fallback
  if (isCapacitorNative() || isMobileViewport()) {
    const printed = await printViaBluetooth(opts.text, opts.title);
    if (printed) return;

    const shared = await shareReceipt(opts.text, opts.title);
    if (shared) return;

    // Final fallback — open the same popup so mobile web users can still print
    printViaPopup(opts);
    return;
  }

  // Desktop / PC → silent thermal popup
  printViaPopup(opts);
};

export default printReceipt;
