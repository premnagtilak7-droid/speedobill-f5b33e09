const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "speedobill7@gmail.com";
// Resend's sandbox sender — works without verifying a domain.
const FROM_ADDRESS = "SpeedoBill <onboarding@resend.dev>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    // Supabase DB webhook payload shape: { type, table, record, old_record, schema }
    // Also accept a plain record body for manual testing.
    const record = payload?.record ?? payload ?? {};

    const ownerName = String(record.owner_name ?? "—");
    const restaurant = String(record.restaurant_name ?? "—");
    const city = String(record.city ?? "—");
    const whatsapp = String(record.whatsapp_number ?? "—");
    const createdAt = record.created_at
      ? new Date(record.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; color: #0f172a;">
        <h2 style="margin: 0 0 16px; color: #f97316;">New Demo Request — SpeedoBill</h2>
        <p style="margin: 0 0 20px; color: #475569;">A new restaurant just requested a demo. Reach out within 2 hours.</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 160px;">Owner Name</td><td style="padding: 8px 0; font-weight: 600;">${escape(ownerName)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Restaurant Name</td><td style="padding: 8px 0; font-weight: 600;">${escape(restaurant)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">City</td><td style="padding: 8px 0; font-weight: 600;">${escape(city)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">WhatsApp Number</td><td style="padding: 8px 0; font-weight: 600;">
            <a href="https://wa.me/91${escape(whatsapp)}" style="color: #f97316; text-decoration: none;">${escape(whatsapp)}</a>
          </td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Submitted At</td><td style="padding: 8px 0;">${escape(createdAt)} IST</td></tr>
        </table>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Sent automatically by SpeedoBill.</p>
      </div>
    `;

    const text = [
      "New Demo Request — SpeedoBill",
      "",
      `Owner Name: ${ownerName}`,
      `Restaurant Name: ${restaurant}`,
      `City: ${city}`,
      `WhatsApp Number: ${whatsapp}`,
      `Submitted At: ${createdAt} IST`,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [NOTIFY_TO],
        subject: "New Demo Request — SpeedoBill",
        html,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Resend send failed:", res.status, data);
      return new Response(JSON.stringify({ error: "Failed to send email", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Demo request notification sent:", data?.id);
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-demo-request error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
