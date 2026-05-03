import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const hotel_code = typeof body.hotel_code === "string" ? body.hotel_code.trim().toUpperCase() : "";

    if (!hotel_code) {
      return new Response(JSON.stringify({ error: "Hotel code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find hotel by code
    const { data: hotel, error: hotelErr } = await adminClient
      .from("hotels")
      .select("id, name")
      .eq("hotel_code", hotel_code)
      .maybeSingle();

    if (hotelErr || !hotel) {
      return new Response(JSON.stringify({ error: "Invalid hotel code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active staff (waiter, chef, manager) for this hotel who have a PIN set
    const { data: profiles, error: profErr } = await adminClient
      .from("profiles")
      .select("user_id, full_name, role")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .in("role", ["waiter", "chef", "manager"]);

    if (profErr) {
      console.error("staff-list-by-code profiles error", profErr);
      return new Response(JSON.stringify({ error: "Failed to load staff" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = (profiles ?? []).map((p) => p.user_id);
    let pinUserIds = new Set<string>();
    if (userIds.length > 0) {
      const { data: pins } = await adminClient
        .from("staff_pins")
        .select("user_id")
        .in("user_id", userIds);
      pinUserIds = new Set((pins ?? []).map((p) => p.user_id));
    }

    const staff = (profiles ?? [])
      .filter((p) => p.full_name && p.full_name.trim() && pinUserIds.has(p.user_id))
      .map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        role: p.role,
      }))
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

    return new Response(
      JSON.stringify({ hotel_id: hotel.id, hotel_name: hotel.name, staff }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("staff-list-by-code error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
