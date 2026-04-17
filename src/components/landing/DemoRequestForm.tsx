import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, CheckCircle2 } from "lucide-react";

const DemoRequestForm = () => {
  const [name, setName] = useState("");
  const [canteenName, setCanteenName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedCanteen = canteenName.trim();
    const trimmedWhatsapp = whatsapp.trim();

    if (!trimmedName || !trimmedCanteen || !trimmedWhatsapp) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (!/^\d{10}$/.test(trimmedWhatsapp)) {
      toast.error("Enter a valid 10-digit WhatsApp number.");
      return;
    }

    setLoading(true);
    const { error } = await (supabase as any)
      .from("demo_requests")
      .insert({ name: trimmedName, canteen_name: trimmedCanteen, whatsapp_number: trimmedWhatsapp });

    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
    toast.success("Demo request submitted! We'll contact you soon.");
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-card/80 p-8 text-center backdrop-blur">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h3 className="text-xl font-bold">Thank You!</h3>
        <p className="text-muted-foreground">
          We've received your request. Our team will reach out on WhatsApp within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur sm:p-8">
      <Input
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        className="h-12"
        required
      />
      <Input
        placeholder="Canteen / Restaurant Name"
        value={canteenName}
        onChange={(e) => setCanteenName(e.target.value)}
        maxLength={100}
        className="h-12"
        required
      />
      <Input
        placeholder="WhatsApp Number (10 digits)"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))}
        inputMode="numeric"
        className="h-12"
        required
      />
      <Button type="submit" size="lg" disabled={loading} className="h-12 gap-2 text-base font-semibold">
        {loading ? "Submitting…" : <>Request a Demo <Send className="h-4 w-4" /></>}
      </Button>
    </form>
  );
};

export default DemoRequestForm;
