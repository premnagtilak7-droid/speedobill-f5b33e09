import { Card, CardContent } from "@/components/ui/card";
import { Bell, QrCode, MessageSquare, Star, ArrowUpRight } from "lucide-react";

const addons = [
  { icon: Bell, title: "Waiter Calling System", desc: "Guests tap a button on the table QR to instantly notify staff." },
  { icon: QrCode, title: "QR Scan & Pay", desc: "Customers scan, pay via UPI and settle their bill in seconds." },
  { icon: MessageSquare, title: "SMS Marketing", desc: "Send offers, festival greetings and reorder reminders to your CRM." },
  { icon: Star, title: "Customer Feedback", desc: "Capture star ratings and reviews automatically after every meal." },
];

const AddOnsSection = () => (
  <section className="border-t px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Power-ups
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore Add-ons that boost your business
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Optional modules to grow revenue, improve service and delight your guests.
          </p>
        </div>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {addons.map((a) => (
          <Card key={a.title} className="group relative overflow-hidden border-border/50 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{a.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Learn more <ArrowUpRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default AddOnsSection;
