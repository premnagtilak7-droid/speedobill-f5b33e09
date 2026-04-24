// Send OneSignal push notifications scoped to a specific hotel.
// Reads ONESIGNAL_REST_API_KEY and ONESIGNAL_APP_ID from Supabase secrets.
//
// Two trusted call modes:
//   1) End-user call: Authorization: Bearer <user_jwt> — hotel resolved from caller's profile.
//   2) Internal/trigger call: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//      — caller MUST pass body.hotelId; this is used by DB webhooks/pg_net triggers.

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
  roles?: Array<"owner" | "manager" | "waiter" | "chef">;
  userIds?: string[];
  data?: Record<string, unknown>;
  url?: string;
  // Required only when called with the service role key (internal/trigger mode)
  hotelId?: string;
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
    const token = authHeader.replace("Bearer ", "").trim();

    const body = (await req.json().catch(() => ({}))) as SendPushBody;
    if (!body?.title || !body?.message) {
      return json({ error: "title and message are required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let hotelId: string | null = null;

    // ── Internal/trigger mode: caller is the service role ──
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      if (!body.hotelId) {
        return json({ error: "hotelId is required for internal calls" }, 400);
      }
      hotelId = body.hotelId;
    } else {
      // ── End-user mode: validate JWT and resolve hotel from profile ──
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return json({ error: "Unauthorized" }, 401);
      }
      const callerId = claimsData.claims.sub as string;

      const { data: callerProfile, error: callerErr } = await admin
        .from("profiles")
        .select("hotel_id")
        .eq("user_id", callerId)
        .maybeSingle();

      if (callerErr || !callerProfile?.hotel_id) {
        return json({ error: "Caller has no hotel" }, 403);
      }
      hotelId = callerProfile.hotel_id as string;
    }

    // Build the audience strictly within the resolved hotel
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
        // ── Sound configuration ──
        // iOS: file must live in the iOS app bundle (or default).
        ios_sound: "bell.wav",
        // Android: file name (no extension) inside res/raw, OR default.
        android_sound: "bell",
        // Bind to the HIGH-importance channel so locked-screen alerts play sound.
        android_channel_id: "speedobill_orders_high",
        // Web push: hint to the OneSignal SW. Web sound playback is best-effort.
        web_push_topic: "order",
        priority: 10,
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
