const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "speedobill7@gmail.com";
// Resend's sandbox sender — works without verifying a domain.
const FROM_ADDRESS = "SpeedoBill <onboarding@resend.dev>";
const ADMIN_DASHBOARD_URL = "https://speedobill.lovable.app/admin";

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
    // Supabase DB webhook payload: { type, table, record, old_record, schema }
    // Also accept a plain record for manual testing.
    const record = payload?.record ?? payload ?? {};

    const name = String(record.owner_name ?? record.name ?? "—");
    const business = String(
      record.canteen_name ?? record.restaurant_name ?? "—"
    );
    const city = String(record.city ?? "—");
    const whatsapp = String(record.whatsapp_number ?? "—");
    const createdAt = record.created_at
      ? new Date(record.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const waLink = `https://wa.me/91${escape(whatsapp)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; color: #0f172a;">
        <h2 style="margin: 0 0 16px; color: #f97316;">🔥 New Demo Request Received!</h2>
        <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escape(name)}</p>
        <p style="margin: 0 0 8px;"><strong>Business:</strong> ${escape(business)}</p>
        <p style="margin: 0 0 8px;"><strong>City:</strong> ${escape(city)}</p>
        <p style="margin: 0 0 8px;"><strong>WhatsApp:</strong>
          <a href="${waLink}" style="color: #f97316; text-decoration: none;">Click to WhatsApp them (${escape(whatsapp)})</a>
        </p>
        <p style="margin: 0 0 20px;"><strong>Time:</strong> ${escape(createdAt)} IST</p>
        <p style="margin: 24px 0 0;">
          <a href="${ADMIN_DASHBOARD_URL}" style="display:inline-block; background:#f97316; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">View in Admin Dashboard</a>
        </p>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Sent automatically by SpeedoBill.</p>
      </div>
    `;

    const text = [
      "🔥 New Demo Request — SpeedoBill",
      "",
      `Name: ${name}`,
      `Business: ${business}`,
      `City: ${city}`,
      `WhatsApp: ${whatsapp} (${waLink})`,
      `Time: ${createdAt} IST`,
      "",
      `Admin: ${ADMIN_DASHBOARD_URL}`,
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
        subject: "🔥 New Demo Request — SpeedoBill",
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

    console.log("notify-demo-lead sent:", data?.id);
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-demo-lead error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
