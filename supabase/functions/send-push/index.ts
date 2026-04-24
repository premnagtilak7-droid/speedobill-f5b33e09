// Send OneSignal push notifications scoped to a specific hotel.
// Reads ONESIGNAL_REST_API_KEY and ONESIGNAL_APP_ID from Supabase secrets.
// Validates the caller's JWT and ensures notifications stay within the caller's hotel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendPushBody {
  title: string;
  message: string;
  // Optional: limit to specific roles within the caller's hotel
  roles?: Array<"owner" | "manager" | "waiter" | "chef">;
  // Optional: limit to specific user ids (must belong to caller's hotel)
  userIds?: string[];
  // Optional: extra data to attach (deep-link path, etc.)
  data?: Record<string, unknown>;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ error: "OneSignal not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const body = (await req.json().catch(() => ({}))) as SendPushBody;
    if (!body?.title || !body?.message) {
      return json({ error: "title and message are required" }, 400);
    }

    // Service role for trusted reads (RLS bypass) — never returned to client
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve caller's hotel — this is the ONLY hotel they can target
    const { data: callerProfile, error: callerErr } = await admin
      .from("profiles")
      .select("hotel_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (callerErr || !callerProfile?.hotel_id) {
      return json({ error: "Caller has no hotel" }, 403);
    }
    const hotelId = callerProfile.hotel_id as string;

    // Build the audience: all users in this hotel, optionally filtered
    let profileQuery = admin
      .from("profiles")
      .select("user_id, role")
      .eq("hotel_id", hotelId)
      .eq("is_active", true);

    if (body.roles && body.roles.length > 0) {
      profileQuery = profileQuery.in("role", body.roles);
    }
    const { data: targets, error: targetErr } = await profileQuery;
    if (targetErr) {
      return json({ error: "Failed to load audience" }, 500);
    }

    let userIds = (targets || []).map((p) => p.user_id as string);
    if (body.userIds && body.userIds.length > 0) {
      const allowed = new Set(userIds);
      userIds = body.userIds.filter((id) => allowed.has(id));
    }

    if (userIds.length === 0) {
      return json({ ok: true, sent: 0, reason: "no recipients" });
    }

    // OneSignal v11+ uses external_id aliases (we set external_id = supabase user_id)
    const oneSignalRes = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: userIds },
        headings: { en: body.title },
        contents: { en: body.message },
        url: body.url,
        data: { hotel_id: hotelId, ...(body.data || {}) },
      }),
    });

    const result = await oneSignalRes.json();
    if (!oneSignalRes.ok) {
      console.error("OneSignal error:", result);
      return json({ error: "OneSignal request failed", details: result }, 502);
    }

    return json({ ok: true, recipients: userIds.length, onesignal: result });
  } catch (e) {
    console.error("send-push error:", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
