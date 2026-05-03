import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

async function verifyHash(stored: string, pin: string): Promise<boolean> {
  // Format: sha256$<saltHex>$<hashHex>
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const saltHex = parts[1];
  const expected = parts[2];
  const data = new TextEncoder().encode(saltHex + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hashHex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hashHex.length; i++) diff |= hashHex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

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
    const user_id = typeof body.user_id === "string" ? body.user_id : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";

    if (!hotel_code || !user_id || !/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "Hotel code, staff and 4-digit PIN are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate hotel
    const { data: hotel } = await adminClient
      .from("hotels")
      .select("id")
      .eq("hotel_code", hotel_code)
      .maybeSingle();

    if (!hotel) {
      return new Response(JSON.stringify({ error: "Invalid hotel code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that staff belongs to this hotel and is active
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id, hotel_id, role, full_name, email, is_active")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile || profile.hotel_id !== hotel.id || !profile.is_active) {
      return new Response(JSON.stringify({ error: "Staff member not found in this hotel" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["waiter", "chef", "manager"].includes(profile.role || "")) {
      return new Response(JSON.stringify({ error: "PIN login is for staff accounts only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PIN record
    const { data: pinRecord } = await adminClient
      .from("staff_pins")
      .select("id, pin_hash, failed_attempts, locked_until")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!pinRecord) {
      return new Response(JSON.stringify({ error: "No PIN set. Please ask owner to set your PIN." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lockout check
    if (pinRecord.locked_until && new Date(pinRecord.locked_until).getTime() > Date.now()) {
      const minsLeft = Math.ceil((new Date(pinRecord.locked_until).getTime() - Date.now()) / 60000);
      return new Response(JSON.stringify({ error: `Account locked. Try again in ${minsLeft} minute(s).` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = await verifyHash(pinRecord.pin_hash, pin);

    if (!ok) {
      const newFailed = (pinRecord.failed_attempts || 0) + 1;
      const updates: Record<string, unknown> = { failed_attempts: newFailed };
      if (newFailed >= MAX_FAILED) {
        updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
        updates.failed_attempts = 0;
      }
      await adminClient.from("staff_pins").update(updates).eq("id", pinRecord.id);

      const remaining = Math.max(0, MAX_FAILED - newFailed);
      const msg = newFailed >= MAX_FAILED
        ? `Too many wrong attempts. Account locked for ${LOCK_MINUTES} minutes.`
        : `Incorrect PIN. ${remaining} attempt(s) remaining.`;
      return new Response(JSON.stringify({ error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset attempts on success
    await adminClient
      .from("staff_pins")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("id", pinRecord.id);

    // Get the user's email to generate a magic link
    const { data: userResp, error: userErr } = await adminClient.auth.admin.getUserById(user_id);
    if (userErr || !userResp?.user?.email) {
      return new Response(JSON.stringify({ error: "Could not load staff account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a magic link; the client will exchange the token_hash for a session
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: userResp.user.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("verify-staff-pin generateLink error", linkErr);
      return new Response(JSON.stringify({ error: "Failed to issue session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_hash: linkData.properties.hashed_token,
        email: userResp.user.email,
        role: profile.role,
        full_name: profile.full_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-staff-pin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
