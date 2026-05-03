import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "speedobill7@gmail.com";

type Action =
  | "suspend"
  | "unsuspend"
  | "extend_subscription"
  | "change_plan"
  | "reset_password"
  | "fetch_user_activity";

interface Body {
  action: Action;
  user_id?: string;
  user_ids?: string[];
  hotel_id?: string;
  days?: number;
  plan?: "free" | "basic" | "premium";
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || userData?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return json({ error: "Forbidden" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as Body;
    const targets = body.user_ids?.length ? body.user_ids : body.user_id ? [body.user_id] : [];

    switch (body.action) {
      case "suspend": {
        if (!targets.length) return json({ error: "user_id required" }, 400);
        // 1) flip profile inactive
        await admin.from("profiles").update({ is_active: false }).in("user_id", targets);
        // 2) ban via auth admin (100 yrs)
        for (const uid of targets) {
          await admin.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
        }
        return json({ ok: true, suspended: targets.length });
      }
      case "unsuspend": {
        if (!targets.length) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({ is_active: true }).in("user_id", targets);
        for (const uid of targets) {
          await admin.auth.admin.updateUserById(uid, { ban_duration: "none" });
        }
        return json({ ok: true, unsuspended: targets.length });
      }
      case "extend_subscription": {
        if (!body.hotel_id || !body.days) return json({ error: "hotel_id and days required" }, 400);
        const { data: hotel } = await admin
          .from("hotels").select("subscription_expiry").eq("id", body.hotel_id).single();
        const base = hotel?.subscription_expiry && new Date(hotel.subscription_expiry) > new Date()
          ? new Date(hotel.subscription_expiry)
          : new Date();
        base.setDate(base.getDate() + body.days);
        await admin.from("hotels").update({ subscription_expiry: base.toISOString() }).eq("id", body.hotel_id);
        return json({ ok: true, new_expiry: base.toISOString() });
      }
      case "change_plan": {
        if (!body.hotel_id || !body.plan) return json({ error: "hotel_id and plan required" }, 400);
        await admin.from("hotels").update({ subscription_tier: body.plan }).eq("id", body.hotel_id);
        return json({ ok: true });
      }
      case "reset_password": {
        if (!body.email) return json({ error: "email required" }, 400);
        const { error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: body.email,
        });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "fetch_user_activity": {
        if (!body.user_id) return json({ error: "user_id required" }, 400);
        const [orders, audit, attendance, purchases] = await Promise.all([
          admin.from("orders").select("id, total, created_at, billed_at, table_id")
            .eq("waiter_id", body.user_id).order("created_at", { ascending: false }).limit(15),
          admin.from("audit_logs").select("action, details, created_at, table_number")
            .eq("performed_by", body.user_id).order("created_at", { ascending: false }).limit(15),
          admin.from("attendance_logs").select("action, created_at")
            .eq("user_id", body.user_id).order("created_at", { ascending: false }).limit(10),
          admin.from("purchase_logs").select("ingredient_id, total_cost, created_at")
            .eq("purchased_by", body.user_id).order("created_at", { ascending: false }).limit(10),
        ]);

        const events: { type: string; text: string; at: string }[] = [];
        for (const o of orders.data ?? []) {
          events.push({
            type: "order",
            text: o.billed_at ? `Generated bill • ₹${Number(o.total).toFixed(0)}` : `Created order • ₹${Number(o.total).toFixed(0)}`,
            at: o.billed_at || o.created_at,
          });
        }
        for (const a of audit.data ?? []) {
          events.push({
            type: "audit",
            text: `${a.action}${a.table_number ? ` • Table ${a.table_number}` : ""}${a.details ? ` — ${a.details}` : ""}`,
            at: a.created_at,
          });
        }
        for (const att of attendance.data ?? []) {
          events.push({ type: "attendance", text: att.action === "clock_in" ? "Clocked in" : "Clocked out", at: att.created_at });
        }
        for (const p of purchases.data ?? []) {
          events.push({ type: "purchase", text: `Purchase logged • ₹${Number(p.total_cost).toFixed(0)}`, at: p.created_at });
        }
        events.sort((a, b) => b.at.localeCompare(a.at));
        return json({ ok: true, events: events.slice(0, 25) });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("admin-user-action error:", err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
