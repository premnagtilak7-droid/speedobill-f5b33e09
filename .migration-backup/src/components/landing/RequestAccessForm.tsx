import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, CheckCircle2, ShieldCheck } from "lucide-react";

const BUSINESS_TYPES = [
  "Restaurant",
  "Cafe",
  "Cloud Kitchen",
  "Canteen",
  "Bar / Pub",
  "Bakery",
  "Sweet Shop",
  "QSR / Fast Food",
  "Other",
];

const CONTACT_TIMES = [
  "Morning (9 AM – 12 PM)",
  "Afternoon (12 PM – 4 PM)",
  "Evening (4 PM – 8 PM)",
  "Anytime",
];

const RequestAccessForm = () => {
  const [ownerName, setOwnerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tables, setTables] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [contactTime, setContactTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedOwner = ownerName.trim();
    const trimmedRestaurant = restaurantName.trim();
    const trimmedCity = city.trim();
    const trimmedWhatsapp = whatsapp.trim();
    const tablesNum = tables ? parseInt(tables, 10) : null;

    if (!trimmedOwner || !trimmedRestaurant || !trimmedCity || !trimmedWhatsapp) {
      toast.error("Please fill in your name, business name, city and WhatsApp number.");
      return;
    }

    if (!/^\d{10}$/.test(trimmedWhatsapp)) {
      toast.error("Enter a valid 10-digit WhatsApp number.");
      return;
    }

    if (tablesNum !== null && (Number.isNaN(tablesNum) || tablesNum < 0 || tablesNum > 9999)) {
      toast.error("Enter a valid number of tables.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("demo_leads").insert({
      owner_name: trimmedOwner,
      restaurant_name: trimmedRestaurant,
      city: trimmedCity,
      whatsapp_number: trimmedWhatsapp,
      number_of_tables: tablesNum,
      business_type: businessType || null,
      preferred_contact_time: contactTime || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
    toast.success("Request received! Our team will reach out soon.");
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-card/90 p-8 text-center shadow-xl backdrop-blur">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold">Thanks — request received!</h3>
        <p className="text-sm text-muted-foreground">
          A SpeedoBill specialist will reach out on WhatsApp within 24 hours to set up your account.
        </p>
        <p className="text-xs text-muted-foreground">
          Already onboarded?{" "}
          <a href="/auth" className="font-semibold text-primary hover:underline">
            Sign in here
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/90 p-6 shadow-xl backdrop-blur sm:p-8"
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        Invite-only access · We'll personally onboard you
      </div>

      <Input
        placeholder="Your full name *"
        value={ownerName}
        onChange={(e) => setOwnerName(e.target.value)}
        maxLength={100}
        className="h-11"
        required
      />

      <Input
        placeholder="Restaurant / Business name *"
        value={restaurantName}
        onChange={(e) => setRestaurantName(e.target.value)}
        maxLength={120}
        className="h-11"
        required
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="City *"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
          className="h-11"
          required
        />
        <Input
          placeholder="WhatsApp (10 digits) *"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          className="h-11"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="Number of tables"
          value={tables}
          onChange={(e) => setTables(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          className="h-11"
        />
        <Select value={businessType} onValueChange={setBusinessType}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Business type" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map((bt) => (
              <SelectItem key={bt} value={bt}>
                {bt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Select value={contactTime} onValueChange={setContactTime}>
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Preferred contact time" />
        </SelectTrigger>
        <SelectContent>
          {CONTACT_TIMES.map((ct) => (
            <SelectItem key={ct} value={ct}>
              {ct}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="mt-2 h-12 gap-2 text-base font-semibold"
      >
        {loading ? "Submitting…" : (
          <>
            Request Access <Send className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <a href="/auth" className="font-semibold text-primary hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
};

export default RequestAccessForm;
