import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action: string = body.action;

    // ── 0. RESOLVE TABLE BY HOTEL + NUMBER (for /menu/:hotelId/:tableNumber URLs) ──
    if (action === "resolve_table") {
      const { hotel_id, table_number } = body;
      if (!hotel_id || typeof hotel_id !== "string" || hotel_id.length < 30) {
        return json({ error: "Invalid hotel_id" }, 400);
      }
      const tn = Number(table_number);
      if (!Number.isFinite(tn) || tn <= 0) {
        return json({ error: "Invalid table_number" }, 400);
      }
      const { data: t } = await admin
        .from("restaurant_tables")
        .select("id")
        .eq("hotel_id", hotel_id)
        .eq("table_number", tn)
        .maybeSingle();
      if (!t) return json({ error: "Table not found" }, 404);
      return json({ table_id: t.id });
    }

    // ── 1. GET TABLE + MENU ──
    if (action === "get_table_menu") {
      const tableId: string = body.table_id;
      if (!tableId || typeof tableId !== "string" || tableId.length < 30) {
        return json({ error: "Invalid table_id" }, 400);
      }

      const { data: table, error: tableErr } = await admin
        .from("restaurant_tables")
        .select("id, table_number, hotel_id, status, section_name")
        .eq("id", tableId)
        .maybeSingle();

      if (tableErr || !table) return json({ error: "Table not found" }, 404);

      const { data: menu } = await admin
        .from("menu_items")
        .select("id, name, price, category, is_available, image_url, price_variants")
        .eq("hotel_id", table.hotel_id)
        .eq("is_available", true)
        .order("category")
        .order("name");

      const { data: loyaltyConfig } = await admin
        .from("hotel_loyalty_configs")
        .select("enabled, visit_goal, reward_type, reward_description, reward_value, min_bill_value")
        .eq("hotel_id", table.hotel_id)
        .maybeSingle();

      const { data: hotel } = await admin
        .from("hotels")
        .select("name, logo_url, business_type, upi_id, upi_qr_url, tax_percent, gst_enabled, waiter_confirms_first, pay_upi_enabled, pay_cash_enabled, pay_card_enabled, pay_razorpay_enabled, pay_request_bill_enabled, tip_options, razorpay_key_id")
        .eq("id", table.hotel_id)
        .maybeSingle();

      return json({
        table: {
          id: table.id,
          table_number: table.table_number,
          hotel_id: table.hotel_id,
          status: table.status,
          section_name: (table as any).section_name,
        },
        menu: menu || [],
        loyalty_config: loyaltyConfig || null,
        hotel: hotel ? { ...hotel, id: table.hotel_id } : null,
      });
    }

    // ── 2. CUSTOMER LOOKUP ──
    if (action === "lookup_customer") {
      const { hotel_id, phone } = body;
      if (!hotel_id || !phone || typeof phone !== "string" || phone.length < 10) {
        return json({ error: "Invalid hotel_id or phone" }, 400);
      }

      const { data } = await admin
        .from("customers")
        .select("name, phone, total_visits, loyalty_points, loyalty_tier, visit_count, rewards_claimed")
        .eq("hotel_id", hotel_id)
        .eq("phone", phone)
        .maybeSingle();

      return json({ customer: data || null });
    }

    // ── 3. PLACE ORDER ──
    if (action === "place_order") {
      const { table_id, hotel_id, table_number, items, customer_name, customer_phone, special_instructions } = body;

      if (!table_id || !hotel_id || !items || !Array.isArray(items) || items.length === 0) {
        return json({ error: "Missing required order fields" }, 400);
      }

      const { data: validTable } = await admin
        .from("restaurant_tables")
        .select("id")
        .eq("id", table_id)
        .eq("hotel_id", hotel_id)
        .maybeSingle();

      if (!validTable) return json({ error: "Invalid table/hotel combination" }, 400);

      const menuItemNames = items.map((i: any) => String(i.name));
      const { data: validMenu } = await admin
        .from("menu_items")
        .select("name")
        .eq("hotel_id", hotel_id)
        .eq("is_available", true)
        .in("name", menuItemNames);

      const validNames = new Set((validMenu || []).map((m: any) => m.name));
      const sanitizedItems = items
        .filter((i: any) => validNames.has(i.name))
        .map((i: any) => ({
          name: String(i.name).slice(0, 200),
          price: Math.max(0, Number(i.price) || 0),
          quantity: Math.min(100, Math.max(1, Math.round(Number(i.quantity) || 1))),
        }));

      if (sanitizedItems.length === 0) {
        return json({ error: "No valid menu items in order" }, 400);
      }

      const safeTotal = sanitizedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

      const { data: inserted, error: orderErr } = await admin
        .from("customer_orders")
        .insert({
          hotel_id,
          table_id,
          table_number: Number(table_number) || 0,
          items: sanitizedItems,
          total_amount: safeTotal,
          customer_name: customer_name ? String(customer_name).slice(0, 100) : null,
          customer_phone: customer_phone ? String(customer_phone).slice(0, 20) : null,
          status: "incoming",
          payment_status: "pending",
          modifiers: special_instructions
            ? [{ note: String(special_instructions).slice(0, 500) }]
            : [],
        })
        .select("id")
        .single();

      if (orderErr) return json({ error: "Failed to place order" }, 500);
      return json({ success: true, order_id: inserted?.id });
    }

    // ── 4. WAITER CALL (water / cutlery / cleaning / menu / bill / other) ──
    if (action === "waiter_call") {
      const { table_id, hotel_id, table_number, request_type, message, guest_name } = body;

      if (!table_id || !hotel_id || !request_type) {
        return json({ error: "Missing fields" }, 400);
      }

      const validTypes = ["water", "cutlery", "cleaning", "menu", "bill", "other", "service"];
      const safeType = validTypes.includes(request_type) ? request_type : "other";

      const { data: validTable } = await admin
        .from("restaurant_tables")
        .select("id")
        .eq("id", table_id)
        .eq("hotel_id", hotel_id)
        .maybeSingle();

      if (!validTable) return json({ error: "Invalid table" }, 400);

      const { error: wcErr } = await admin.from("waiter_calls").insert({
        hotel_id,
        table_id,
        table_number: Number(table_number) || 0,
        request_type: safeType,
        message: message ? String(message).slice(0, 200) : "",
        guest_name: guest_name ? String(guest_name).slice(0, 100) : "",
        status: "pending",
      });

      if (wcErr) return json({ error: "Failed to send request" }, 500);
      return json({ success: true });
    }

    // ── 4b. LEGACY service_call (kept for backward compatibility) ──
    if (action === "service_call") {
      const { table_id, hotel_id, table_number, call_type } = body;
      if (!table_id || !hotel_id || !call_type) {
        return json({ error: "Missing service call fields" }, 400);
      }
      const validTypes = ["service", "water"];
      if (!validTypes.includes(call_type)) {
        return json({ error: "Invalid call type" }, 400);
      }
      const { data: validTable } = await admin
        .from("restaurant_tables")
        .select("id")
        .eq("id", table_id)
        .eq("hotel_id", hotel_id)
        .maybeSingle();
      if (!validTable) return json({ error: "Invalid table" }, 400);
      const { error: scErr } = await admin.from("service_calls").insert({
        hotel_id,
        table_id,
        table_number: Number(table_number) || 0,
        call_type,
        status: "active",
      });
      if (scErr) return json({ error: "Failed to send request" }, 500);
      return json({ success: true });
    }

    // ── 5. GET ORDER STATUS (for live tracker) ──
    if (action === "get_order_status") {
      const { order_id } = body;
      if (!order_id) return json({ error: "Missing order_id" }, 400);
      const { data } = await admin
        .from("customer_orders")
        .select("id, status, payment_status, total_amount, table_number, created_at")
        .eq("id", order_id)
        .maybeSingle();
      if (!data) return json({ error: "Order not found" }, 404);
      return json({ order: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("qr-order error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
