/**
 * Customer-facing payment flow with fraud prevention.
 *
 * 1. PaymentMethodSheet — owner-configurable methods (UPI/Cash/Card/Razorpay/Request Bill).
 * 2. UpiPayPanel        — shows QR + UPI ID, 5-min countdown, mandatory 12-digit UTR.
 * 3. PaymentStatusBanner — Pending → Verifying → Verified / Rejected (live via Realtime).
 *
 * Each action creates a row in `public.payment_attempts` so staff can verify in
 * the OrderRealtimeAlert panel.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Wallet, QrCode, Banknote, CreditCard, Receipt, CheckCircle2,
  Loader2, ShieldCheck, Clock, X, AlertTriangle,
} from "lucide-react";

export interface PaymentHotel {
  id?: string;
  name: string;
  upi_id: string | null;
  upi_qr_url: string | null;
  pay_upi_enabled?: boolean;
  pay_cash_enabled?: boolean;
  pay_card_enabled?: boolean;
  pay_razorpay_enabled?: boolean;
  pay_request_bill_enabled?: boolean;
  tip_options?: number[] | null;
  payment_verify_mode?: string | null;
}

export type PaymentMethod = "upi" | "cash" | "card" | "razorpay" | "request_bill";

interface Args {
  hotel: PaymentHotel & { id: string };
  tableId: string;
  tableNumber: number;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  orderId?: string | null;
  onClose: () => void;
}

// ── Sheet container ────────────────────────────────────────────────────────
export function PaymentMethodSheet(props: Args) {
  const { hotel, amount, onClose } = props;
  const [step, setStep] = useState<"choose" | "upi" | "status">("choose");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [tip, setTip] = useState(0);

  const tipOptions = useMemo(() => {
    const raw = Array.isArray(hotel.tip_options) ? hotel.tip_options : [5, 10, 15];
    return raw.filter((n) => Number.isFinite(n) && n >= 0).slice(0, 4);
  }, [hotel.tip_options]);

  const total = amount + tip;

  const enabledMethods = useMemo(() => {
    const m: { id: PaymentMethod; label: string; desc: string; icon: any; color: string }[] = [];
    if (hotel.pay_upi_enabled !== false && (hotel.upi_id || hotel.upi_qr_url))
      m.push({ id: "upi", label: "Pay via UPI", desc: "Scan QR / GPay / PhonePe", icon: QrCode, color: "from-emerald-500 to-emerald-600" });
    if (hotel.pay_cash_enabled !== false)
      m.push({ id: "cash", label: "Pay Cash to Waiter", desc: "Waiter will collect", icon: Banknote, color: "from-amber-500 to-orange-600" });
    if (hotel.pay_card_enabled === true)
      m.push({ id: "card", label: "Pay by Card", desc: "Waiter brings the POS machine", icon: CreditCard, color: "from-blue-500 to-blue-600" });
    if (hotel.pay_razorpay_enabled === true)
      m.push({ id: "razorpay", label: "Pay with Razorpay", desc: "Cards / UPI / NetBanking", icon: Wallet, color: "from-indigo-500 to-purple-600" });
    if (hotel.pay_request_bill_enabled !== false)
      m.push({ id: "request_bill", label: "Request Physical Bill", desc: "Pay however you like", icon: Receipt, color: "from-slate-500 to-slate-700" });
    return m;
  }, [hotel]);

  // Create attempt row (always — gives waiter a notification)
  const createAttempt = async (method: PaymentMethod, utr?: string) => {
    const payload = {
      hotel_id: hotel.id,
      table_id: props.tableId,
      table_number: props.tableNumber,
      order_id: props.orderId ?? null,
      method,
      amount,
      tip_amount: tip,
      utr: utr || null,
      status: method === "upi" ? "verifying" : "pending",
      customer_name: props.customerName || "",
      customer_phone: props.customerPhone || "",
    };
    const { data, error } = await supabase
      .from("payment_attempts")
      .insert(payload as any)
      .select("id")
      .single();
    if (error) {
      toast.error("Could not notify waiter: " + error.message);
      return null;
    }
    return (data as any).id as string;
  };

  const handleNonUpiSelect = async (m: PaymentMethod) => {
    setSelectedMethod(m);
    const id = await createAttempt(m);
    if (!id) return;
    setAttemptId(id);
    setStep("status");
    const friendly =
      m === "cash" ? "Waiter notified — please pay cash" :
      m === "card" ? "Waiter is bringing the card machine" :
      m === "razorpay" ? "Razorpay coming — wait for waiter" :
      "Waiter is bringing your bill";
    toast.success(friendly);
  };

  const handleUpiSubmit = async (utr: string) => {
    setSelectedMethod("upi");
    const id = await createAttempt("upi", utr);
    if (!id) return;
    setAttemptId(id);
    setStep("status");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-border/40 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              {step === "choose" && "Choose Payment"}
              {step === "upi" && "Pay via UPI"}
              {step === "status" && "Payment Status"}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Table {props.tableNumber} · ₹{total.toFixed(0)}
          </p>
        </div>

        {step === "choose" && (
          <div className="p-5 space-y-4">
            {tipOptions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Tip your waiter (optional)
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setTip(0)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      tip === 0 ? "bg-foreground text-background border-foreground" : "bg-muted/40 border-border"
                    }`}
                  >No tip</button>
                  {tipOptions.map((pct) => {
                    const v = Math.round((amount * pct) / 100);
                    return (
                      <button
                        key={pct}
                        onClick={() => setTip(v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          tip === v ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted/40 border-border"
                        }`}
                      >{pct}% · ₹{v}</button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-muted/30 rounded-2xl p-3 flex justify-between items-center">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total to pay</p>
                <p className="text-2xl font-black">₹{total.toFixed(0)}</p>
              </div>
              {tip > 0 && (
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Bill ₹{amount.toFixed(0)}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold">+ Tip ₹{tip}</p>
                </div>
              )}
            </div>

            {enabledMethods.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
                <p className="text-sm font-semibold">No payment methods configured</p>
                <p className="text-xs text-muted-foreground">Please ask the waiter for the bill.</p>
              </div>
            )}

            <div className="space-y-2">
              {enabledMethods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => m.id === "upi" ? setStep("upi") : handleNonUpiSelect(m.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${m.color} text-white shadow-md active:scale-[0.98] transition`}
                >
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{m.label}</p>
                    <p className="text-[11px] opacity-90">{m.desc}</p>
                  </div>
                  <span className="text-xl">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "upi" && (
          <UpiPayPanel
            hotel={hotel}
            tableNumber={props.tableNumber}
            amount={total}
            onBack={() => setStep("choose")}
            onSubmit={handleUpiSubmit}
          />
        )}

        {step === "status" && attemptId && (
          <PaymentStatusPanel
            attemptId={attemptId}
            method={selectedMethod!}
            amount={total}
            onClose={onClose}
            onRetry={() => { setAttemptId(null); setStep("choose"); }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

// ── UPI panel with timer + UTR ─────────────────────────────────────────────
function UpiPayPanel({
  hotel, tableNumber, amount, onBack, onSubmit,
}: {
  hotel: PaymentHotel;
  tableNumber: number;
  amount: number;
  onBack: () => void;
  onSubmit: (utr: string) => void;
}) {
  const [utr, setUtr] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(5 * 60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const upiId = hotel.upi_id || "";
  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(hotel.name || "Restaurant")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Table ${tableNumber}`)}`
    : "";
  const qrSrc = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`
    : (hotel.upi_qr_url || "");

  const isManualMode = (hotel.payment_verify_mode || "manual") === "manual";
  const utrOk = /^\d{12}$/.test(utr.trim());
  const canSubmit = isManualMode ? true : utrOk;
  const expired = secondsLeft === 0;
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  const handleClick = async () => {
    if (!canSubmit || expired) return;
    setSubmitting(true);
    try {
      await onSubmit(isManualMode ? utr.trim() : utr.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${
        expired ? "bg-red-100 text-red-700" : secondsLeft < 60 ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
      }`}>
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {expired ? "Time expired — refresh & retry" : `Pay within ${mm}:${ss}`}
        </span>
        <span className="text-[11px] flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure</span>
      </div>

      {qrSrc ? (
        <>
          <div className="bg-white p-3 rounded-2xl border-2 border-emerald-200 mx-auto w-fit">
            <img src={qrSrc} alt="UPI QR code" className="w-52 h-52" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">Scan with any UPI app</p>
            <p className="text-[11px] text-muted-foreground">PhonePe · GPay · Paytm · BHIM</p>
            {upiId && (
              <p className="text-xs font-mono bg-muted/40 px-2 py-1 rounded inline-block mt-1">{upiId}</p>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground">UPI not configured.</div>
      )}

      <div className="space-y-2 pt-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          UTR / Transaction ID (12 digits) {isManualMode && <span className="text-muted-foreground/70 font-normal normal-case">— optional</span>}
        </label>
        <Input
          inputMode="numeric"
          maxLength={12}
          placeholder={isManualMode ? "Optional — speeds up verification" : "e.g. 412345678901"}
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
          className="h-12 text-center font-mono text-lg tracking-wider rounded-xl"
          disabled={expired}
        />
        <p className="text-[11px] text-muted-foreground">
          {isManualMode
            ? "🔔 The waiter's sound box will confirm your payment. UTR helps but isn't required."
            : "🔒 Find this 12-digit number in your UPI app under \"Transaction details\" after paying."}
        </p>
      </div>

      <Button
        onClick={handleClick}
        disabled={!canSubmit || expired || submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold disabled:opacity-50"
        style={{ height: 52 }}
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <><CheckCircle2 className="h-5 w-5 mr-2" /> I have paid — verify with waiter</>
        )}
      </Button>
      <Button variant="outline" onClick={onBack} className="w-full rounded-2xl">Back</Button>
    </div>
  );
}

// ── Status panel (live polling via Realtime) ───────────────────────────────
function PaymentStatusPanel({
  attemptId, method, amount, onClose, onRetry,
}: {
  attemptId: string;
  method: PaymentMethod;
  amount: number;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [status, setStatus] = useState<string>(method === "upi" ? "verifying" : "pending");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    // initial fetch
    (async () => {
      const { data } = await supabase
        .from("payment_attempts")
        .select("status, rejection_reason")
        .eq("id", attemptId)
        .maybeSingle();
      if (!cancelled && data) {
        setStatus((data as any).status);
        setReason((data as any).rejection_reason || "");
      }
    })();

    const channel = supabase
      .channel(`pay-${attemptId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "payment_attempts",
        filter: `id=eq.${attemptId}`,
      }, (payload) => {
        const next = payload.new as any;
        setStatus(next.status);
        setReason(next.rejection_reason || "");
        if (next.status === "verified") {
          try { navigator.vibrate?.([60, 30, 60]); } catch {}
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [attemptId]);

  const ui = (() => {
    switch (status) {
      case "verified":
        return { icon: CheckCircle2, label: "Payment Verified", color: "text-emerald-600 bg-emerald-50", emoji: "✅",
          desc: "Thank you! Enjoy your meal." };
      case "rejected":
        return { icon: X, label: "Payment Rejected", color: "text-red-600 bg-red-50", emoji: "❌",
          desc: reason || "Waiter could not confirm. Please try again." };
      case "verifying":
        return { icon: Loader2, label: "Verification in Progress", color: "text-blue-600 bg-blue-50", emoji: "🔄",
          desc: "Waiter is verifying your UPI payment in their app." };
      case "pending":
      default:
        return { icon: Clock, label: "Pending Payment", color: "text-amber-600 bg-amber-50", emoji: "⏳",
          desc: method === "cash" ? "Please pay cash to the waiter when they arrive."
              : method === "card" ? "Waiter will bring the card machine."
              : method === "razorpay" ? "Waiter is preparing Razorpay payment."
              : "Waiter is bringing your bill." };
    }
  })();

  const Icon = ui.icon;
  const spinning = status === "verifying";

  return (
    <div className="p-6 space-y-5">
      <div className="text-center space-y-3">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${ui.color}`}>
          <Icon className={`h-10 w-10 ${spinning ? "animate-spin" : ""}`} />
        </div>
        <div>
          <p className="text-2xl font-black">{ui.emoji} {ui.label}</p>
          <p className="text-sm text-muted-foreground mt-1">{ui.desc}</p>
        </div>
        <p className="text-xs text-muted-foreground">Amount ₹{amount.toFixed(0)}</p>
      </div>

      {status === "rejected" ? (
        <div className="space-y-2">
          <Button onClick={onRetry} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold" style={{ height: 52 }}>
            Try Again
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full rounded-2xl">Close</Button>
        </div>
      ) : status === "verified" ? (
        <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold" style={{ height: 52 }}>
          Done
        </Button>
      ) : (
        <Button variant="outline" onClick={onClose} className="w-full rounded-2xl">
          Close — I'll wait
        </Button>
      )}
    </div>
  );
}
