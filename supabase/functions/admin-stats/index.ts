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

    // Verify caller is the platform admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || userData?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const [hotelsRes, profilesRes, rolesRes] = await Promise.all([
      admin.from("hotels").select("id, name, owner_id, subscription_tier, subscription_expiry, created_at, phone").limit(2000),
      admin.from("profiles").select("user_id, full_name, role, hotel_id, subscription_status, trial_ends_at, created_at, email, phone").limit(5000),
      admin.from("user_roles").select("user_id, role").limit(5000),
    ]);

    if (hotelsRes.error) throw hotelsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (rolesRes.error) throw rolesRes.error;

    // Build a map: user_id -> role from user_roles (source of truth)
    const roleMap = new Map<string, string>();
    for (const r of rolesRes.data ?? []) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
    }

    // Enrich profiles with authoritative role
    const enrichedProfiles = (profilesRes.data ?? []).map((p) => ({
      ...p,
      role: roleMap.get(p.user_id) ?? p.role ?? "owner",
    }));

    return new Response(
      JSON.stringify({
        hotels: hotelsRes.data ?? [],
        profiles: enrichedProfiles,
        roles: rolesRes.data ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("admin-stats error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
