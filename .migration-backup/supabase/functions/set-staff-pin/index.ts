import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash a PIN with SHA-256 + per-record salt. Format: "sha256$<saltHex>$<hashHex>"
async function hashPin(pin: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const data = new TextEncoder().encode(saltHex + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256$${saltHex}$${hashHex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Caller must be an owner
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "owner");

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Only owners can set staff PINs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller's hotel
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("hotel_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!callerProfile?.hotel_id) {
      return new Response(JSON.stringify({ error: "No hotel found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const target_user_id = typeof body.target_user_id === "string" ? body.target_user_id : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject trivially weak PINs
    if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0000") {
      return new Response(JSON.stringify({ error: "PIN is too easy to guess" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the target staff belongs to caller's hotel
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("user_id, hotel_id, full_name")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetProfile || targetProfile.hotel_id !== callerProfile.hotel_id) {
      return new Response(JSON.stringify({ error: "Staff member not in your hotel" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pin_hash = await hashPin(pin);

    // Upsert staff_pins (one record per user)
    const { data: existing } = await adminClient
      .from("staff_pins")
      .select("id")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await adminClient
        .from("staff_pins")
        .update({
          pin_hash,
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error("set-staff-pin update error", updErr);
        return new Response(JSON.stringify({ error: "Failed to update PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: insErr } = await adminClient
        .from("staff_pins")
        .insert({
          user_id: target_user_id,
          hotel_id: callerProfile.hotel_id,
          pin_hash,
          failed_attempts: 0,
        });
      if (insErr) {
        console.error("set-staff-pin insert error", insErr);
        return new Response(JSON.stringify({ error: "Failed to create PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("set-staff-pin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
