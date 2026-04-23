import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATOR_EMAIL = "speedobill7@gmail.com";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the platform creator may call this
    if ((userData.user.email || "").toLowerCase() !== CREATOR_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 200) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
    const hotelName = typeof body.hotel_name === "string" ? body.hotel_name.trim().slice(0, 200) : "";
    const city = typeof body.city === "string" ? body.city.trim().slice(0, 100) : "";
    const businessType = typeof body.business_type === "string" ? body.business_type.trim().slice(0, 60) : "";
    const tier = ["free", "basic", "premium"].includes(body.subscription_tier) ? body.subscription_tier : "premium";
    const trialDays = Number.isInteger(body.trial_days) ? Math.max(0, Math.min(365, body.trial_days)) : 30;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!hotelName) {
      return new Response(JSON.stringify({ error: "Hotel name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create the auth user (handle_new_user trigger will seed profile + owner role + a default hotel)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "owner" },
    });

    if (createErr || !created?.user) {
      const safe = createErr?.message?.includes("already registered")
        ? "A user with this email already exists"
        : (createErr?.message || "Failed to create user");
      return new Response(JSON.stringify({ error: safe }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;

    // 2) Wait briefly for trigger-created hotel + profile, then update
    let hotelId: string | null = null;
    for (let i = 0; i < 5; i++) {
      const { data: prof } = await admin
        .from("profiles")
        .select("hotel_id")
        .eq("user_id", newUserId)
        .maybeSingle();
      if (prof?.hotel_id) { hotelId = prof.hotel_id; break; }
      await new Promise((r) => setTimeout(r, 400));
    }

    // Fallback: locate the owner-created hotel
    if (!hotelId) {
      const { data: h } = await admin
        .from("hotels")
        .select("id")
        .eq("owner_id", newUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      hotelId = h?.id ?? null;
    }

    if (!hotelId) {
      return new Response(JSON.stringify({ error: "User created but hotel was not initialized. Check trigger." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Update hotel with the real details + trial expiry + tier
    const expiry = new Date(Date.now() + trialDays * 86400000).toISOString();
    const { error: hotelErr } = await admin
      .from("hotels")
      .update({
        name: hotelName,
        phone: phone || "",
        address: city || "",
        business_type: businessType || "Restaurant",
        subscription_tier: tier,
        subscription_start_date: new Date().toISOString(),
        subscription_expiry: expiry,
      })
      .eq("id", hotelId);

    if (hotelErr) {
      console.error("hotel update failed:", hotelErr);
    }

    // 4) Update profile details
    await admin
      .from("profiles")
      .update({
        full_name: fullName || hotelName,
        phone: phone || "",
        email,
        hotel_id: hotelId,
        role: "owner",
        subscription_status: "active",
        subscription_plan: tier,
        subscription_expires_at: expiry,
      })
      .eq("user_id", newUserId);

    // 5) Get the freshly-issued hotel code
    const { data: finalHotel } = await admin
      .from("hotels")
      .select("hotel_code, name")
      .eq("id", hotelId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        hotel_id: hotelId,
        hotel_code: finalHotel?.hotel_code ?? null,
        email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-hotel-owner error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
