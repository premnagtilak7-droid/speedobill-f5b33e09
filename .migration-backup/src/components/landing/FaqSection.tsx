import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "Does Speedo Bill work without internet (offline mode)?",
    a: "Yes. Speedo Bill keeps billing functional even when your internet drops. Orders, KOTs and bills are queued locally on the device and automatically sync to the cloud the moment connectivity returns — so your counter never stops.",
  },
  {
    q: "Is GST billing supported? Can I print GST-compliant invoices?",
    a: "Absolutely. You can enable GST from Settings, set your tax percentage (5%, 12%, 18%), add your GSTIN, and every printed or WhatsApp receipt will be a valid GST-compliant invoice with tax breakup (CGST/SGST).",
  },
  {
    q: "Can I run Speedo Bill on multiple devices at the same time?",
    a: "Yes. The Master POS runs on a PC, your waiters use the mobile app on Android phones or tablets, and the kitchen sees orders live on the KOT display — all synced in real time through the cloud.",
  },
  {
    q: "How do I migrate my existing menu and customer data?",
    a: "We offer free onboarding. Our team imports your existing menu, categories, prices and customer database for you. The AI Menu Scanner can also extract items directly from a photo of your printed menu card.",
  },
  {
    q: "Is my restaurant data safe and secure?",
    a: "Your data is encrypted in transit and at rest, hosted on enterprise-grade cloud infrastructure with daily backups. Role-based access control ensures waiters, chefs and managers only see what they're allowed to.",
  },
  {
    q: "What hardware do I need to get started?",
    a: "Just an Android phone or any PC with a browser. Optionally, you can connect a thermal printer (USB or Bluetooth), a cash drawer, and a kitchen display screen — Speedo Bill works with most standard restaurant hardware.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes. There are no long-term contracts. You can upgrade, downgrade or cancel your plan anytime from the Billing page. Your data remains accessible during your billing cycle.",
  },
];

const FaqSection = () => (
  <section id="faq" className="border-t bg-muted/30 px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-4 text-muted-foreground">
          Everything you need to know about Speedo Bill. Can't find the answer? Chat with our team.
        </p>
      </div>

      <Accordion type="single" collapsible className="mt-12 w-full space-y-3">
        {faqs.map((f, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="overflow-hidden rounded-xl border border-border/60 bg-card px-5 transition-colors hover:border-primary/40 data-[state=open]:border-primary/50 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FaqSection;
