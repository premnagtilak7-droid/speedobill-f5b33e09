/**
 * Razorpay webhook receiver — auto-verifies payment_attempts when Razorpay confirms.
 *
 * Setup: in Razorpay dashboard, create a webhook pointing to:
 *   https://<project>.functions.supabase.co/razorpay-webhook
 * Subscribe to events: payment.captured
 * Set the secret in Supabase secrets as RAZORPAY_WEBHOOK_SECRET.
 *
 * Razorpay signs the payload with HMAC-SHA256 over the raw body using the secret.
 * Header: X-Razorpay-Signature
 *
 * Matching strategy: Razorpay payment notes should include `attempt_id` (uuid)
 * so we can update the right payment_attempts row. If absent, we fall back to
 * matching on hotel_id + amount within the last 10 minutes (best-effort).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "RAZORPAY_WEBHOOK_SECRET not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("x-razorpay-signature") || "";
  const rawBody = await req.text();

  const ok = await verifySignature(secret, rawBody, signature);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let evt: any;
  try { evt = JSON.parse(rawBody); } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (evt.event !== "payment.captured") {
    // ignore other events
    return new Response(JSON.stringify({ ignored: evt.event }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payment = evt.payload?.payment?.entity;
  if (!payment) {
    return new Response(JSON.stringify({ error: "No payment entity" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const attemptId = payment.notes?.attempt_id || null;
  const utr = payment.acquirer_data?.upi_transaction_id || payment.acquirer_data?.rrn || payment.id;

  if (attemptId) {
    const { error } = await supabase
      .from("payment_attempts")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by_name: "Razorpay Webhook",
        utr,
      })
      .eq("id", attemptId);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, attemptId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fallback — match by amount within last 10 minutes
  const amountInr = Number(payment.amount) / 100;
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: candidates } = await supabase
    .from("payment_attempts")
    .select("id, amount, tip_amount, hotel_id")
    .eq("method", "razorpay")
    .eq("status", "pending")
    .gte("created_at", tenMinAgo);
  const match = (candidates ?? []).find(
    (c: any) => Math.abs(Number(c.amount) + Number(c.tip_amount || 0) - amountInr) < 1,
  );
  if (match) {
    await supabase
      .from("payment_attempts")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by_name: "Razorpay Webhook (auto-match)",
        utr,
      })
      .eq("id", match.id);
    return new Response(JSON.stringify({ ok: true, matchedId: match.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, unmatched: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
