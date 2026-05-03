import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

type FieldErrors = {
  name?: string;
  restaurant?: string;
  city?: string;
  whatsapp?: string;
};

const DemoBookingForm = () => {
  const [name, setName] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = "Owner name is required";
    if (!restaurant.trim()) e.restaurant = "Restaurant name is required";
    if (!city.trim()) e.city = "City is required";
    if (!whatsapp.trim()) {
      e.whatsapp = "WhatsApp number is required";
    } else if (!/^\d{10}$/.test(whatsapp.trim())) {
      e.whatsapp = "Enter a valid 10-digit WhatsApp number";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    const { error } = await (supabase as any)
      .from("demo_leads")
      .insert({
        owner_name: name.trim(),
        restaurant_name: restaurant.trim(),
        city: city.trim(),
        whatsapp_number: whatsapp.trim(),
      });

    setLoading(false);
    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="border-primary/20 bg-card/80 backdrop-blur">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary animate-[scale-in_0.4s_ease-out]" />
            </div>
          </div>
          <h3 className="text-xl font-bold">Demo Booked Successfully!</h3>
          <p className="text-base font-medium leading-relaxed max-w-xs">
            Thanks! Our team will contact you on WhatsApp within 2 hours. ✅
          </p>
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            We're excited to have you!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <Label htmlFor="owner-name" className="text-sm font-medium">Owner Name</Label>
            <Input
              id="owner-name"
              placeholder="Rajesh Kumar"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              maxLength={100}
              aria-invalid={!!errors.name}
              className="mt-1.5"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="restaurant-name" className="text-sm font-medium">Restaurant Name</Label>
            <Input
              id="restaurant-name"
              placeholder="Spice Garden"
              value={restaurant}
              onChange={(e) => {
                setRestaurant(e.target.value);
                if (errors.restaurant) setErrors((prev) => ({ ...prev, restaurant: undefined }));
              }}
              maxLength={100}
              aria-invalid={!!errors.restaurant}
              className="mt-1.5"
            />
            {errors.restaurant && <p className="mt-1 text-xs text-red-500">{errors.restaurant}</p>}
          </div>
          <div>
            <Label htmlFor="city" className="text-sm font-medium">City</Label>
            <Input
              id="city"
              placeholder="Mumbai"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }));
              }}
              maxLength={60}
              aria-invalid={!!errors.city}
              className="mt-1.5"
            />
            {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
          </div>
          <div>
            <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp Number</Label>
            <Input
              id="whatsapp"
              placeholder="9876543210"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (errors.whatsapp) setErrors((prev) => ({ ...prev, whatsapp: undefined }));
              }}
              inputMode="numeric"
              aria-invalid={!!errors.whatsapp}
              className="mt-1.5"
            />
            {errors.whatsapp && <p className="mt-1 text-xs text-red-500">{errors.whatsapp}</p>}
          </div>
          <Button type="submit" className="mt-2 w-full font-semibold" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule Free Demo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DemoBookingForm;
