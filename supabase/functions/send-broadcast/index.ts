import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "speedobill7@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || userData?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    const style = body.style === "banner" ? "banner" : "popup";
    const targets = body.targets ?? {};
    const target_owners = !!targets.owners;
    const target_waiters = !!targets.waiters;
    const target_chefs = !!targets.chefs;
    const target_managers = !!targets.managers;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!target_owners && !target_waiters && !target_chefs && !target_managers) {
      return new Response(JSON.stringify({ error: "Select at least one audience" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Collect recipient emails (only owners get email by default; staff just get in-app)
    const wantedRoles: string[] = [];
    if (target_owners) wantedRoles.push("owner");
    if (target_waiters) wantedRoles.push("waiter");
    if (target_chefs) wantedRoles.push("chef");
    if (target_managers) wantedRoles.push("manager");

    const { data: rolesData } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", wantedRoles);

    const userIds = Array.from(new Set((rolesData ?? []).map((r: any) => r.user_id)));

    let emails: string[] = [];
    if (userIds.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);
      emails = (profs ?? [])
        .map((p: any) => (p.email || "").trim())
        .filter((e: string) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    }

    let emailSent = 0;
    if (resendKey && emails.length) {
      // Send a single email to admin with BCC to all (one HTTP call, fast)
      const html = `
        <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; padding:24px;">
          <h2 style="color:#F97316; margin:0 0 16px;">📢 SpeedoBill Announcement</h2>
          <div style="background:#FFF7ED; border-left:4px solid #F97316; padding:16px; border-radius:8px; color:#1f2937; line-height:1.6;">
            ${message.replace(/\n/g, "<br/>")}
          </div>
          <p style="margin-top:24px; color:#6b7280; font-size:12px;">— Team SpeedoBill</p>
        </div>`;

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "SpeedoBill <onboarding@resend.dev>",
            to: [ADMIN_EMAIL],
            bcc: emails.slice(0, 50), // Resend BCC limit safety
            subject: "📢 SpeedoBill — New Announcement",
            html,
          }),
        });
        if (r.ok) emailSent = emails.length;
        else console.error("Resend failure:", await r.text());
      } catch (e) {
        console.error("Resend error:", e);
      }
    }

    // Insert broadcast row (in-app)
    const { data: inserted, error: insertErr } = await admin
      .from("broadcasts")
      .insert({
        message,
        style,
        target_owners,
        target_waiters,
        target_chefs,
        target_managers,
        sent_via_email: emailSent > 0,
        email_recipients_count: emailSent,
        created_by: callerId,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        broadcast_id: inserted.id,
        recipients_in_app: userIds.length,
        emails_sent: emailSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-broadcast error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
