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

    // Verify caller via getUser
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

    // Check caller is owner or manager
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["owner", "manager"]);

    const isOwner = callerRoles?.some((r: any) => r.role === "owner");
    const isManager = callerRoles?.some((r: any) => r.role === "manager");

    if (!isOwner && !isManager) {
      return new Response(JSON.stringify({ error: "Only owners or managers can add staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's hotel
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

    // ── Input validation ──
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const full_name = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 200) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : "";
    const password = typeof body.password === "string" ? body.password : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!role) {
      return new Response(JSON.stringify({ error: "Role is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedRoles = ["waiter", "chef", "manager"];
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Role must be one of: ${allowedRoles.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Managers cannot create other managers — only owners can
    if (role === "manager" && !isOwner) {
      return new Response(JSON.stringify({ error: "Only owners can create manager accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Password strength check for staff
    if (password && password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { full_name: full_name || "", role },
    });

    if (createError) {
      // Don't leak internal error details
      const safeMsg = createError.message?.includes("already registered")
        ? "A user with this email already exists"
        : "Failed to create user";
      return new Response(JSON.stringify({ error: safeMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    // Update profile with hotel_id, role, phone, name (retry to handle trigger race)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: profileRow } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", newUserId)
        .maybeSingle();
      if (profileRow) {
        await adminClient
          .from("profiles")
          .update({
            hotel_id: callerProfile.hotel_id,
            role,
            full_name: full_name || "",
            phone: phone || "",
          })
          .eq("user_id", newUserId);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Ensure user_roles entry exists
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .eq("role", role)
      .maybeSingle();

    if (!existingRole) {
      await adminClient
        .from("user_roles")
        .insert({ user_id: newUserId, role });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-staff error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});