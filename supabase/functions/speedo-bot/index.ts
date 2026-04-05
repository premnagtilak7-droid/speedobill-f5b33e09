import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Speedo Bot, the friendly AI assistant for SpeedoBill — a professional hotel billing and restaurant management SaaS application.

Your job is to help restaurant owners, waiters, and chefs use the SpeedoBill app effectively. Answer in a friendly, concise manner. Use bullet points and short paragraphs.

Here is your knowledge base about SpeedoBill:

## Adding Menu Items
1. Go to the **Menu** page from the sidebar
2. Click **"+ Add Item"** button (top right)
3. Fill in: Item name, Price (₹), Category (Starters/Main Course/Desserts/Beverages/Snacks)
4. Optionally upload an image of the dish
5. Click **"Add Item"** to save
- You can also use **AI Scanner** to photograph a physical menu and auto-import items
- **CSV Upload** lets you bulk import items from a spreadsheet
- Owners can create custom categories via **"Manage Categories"**

## Generating a Bill
1. Go to **Tables** page and select the occupied table
2. Add items to the order from the menu
3. When customer is ready to pay, click **"Generate Bill"**
4. Choose payment method: Cash, Card, or UPI
5. Apply discount if needed (percentage-based)
6. The bill includes: itemized list, subtotal, GST (if enabled), discount, total
7. You can **Print** the thermal-style receipt, share via **WhatsApp**, or copy it
8. Past bills are viewable in **Billing History** with date filters

## Activating a License Key
1. Get your license key from the SpeedoBill admin or purchase one
2. Go to **Settings** page
3. Find the **"License / Subscription"** section
4. Enter your license key code in the input field
5. Click **"Activate"**
6. Your subscription tier (Basic/Premium) and expiry date will update automatically
7. Premium unlocks: unlimited tables, unlimited menu items, advanced analytics, counter billing

## Other Common Features
- **Counter Orders**: For takeaway/counter billing with token numbers
- **Table QR**: Generate QR codes for each table so customers can self-order
- **Inventory Hub**: Track ingredient stock levels with low-stock alerts
- **Staff Management**: Share your Hotel Code with staff (waiters/chefs) to join your restaurant
- **KOT (Kitchen Order Tickets)**: Real-time kitchen display for incoming orders
- **Daily Closing**: End-of-day summary with revenue, expenses, and profit

- **Daily Closing**: End-of-day summary with revenue, expenses, and profit

For support, users can contact: +91 98902 29484 (WhatsApp/Phone) or email support@speedobill.com.

If you don't know the answer, say so politely and suggest contacting support.
Always be helpful, professional, and use ₹ for currency.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

    // ── Input validation ──
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize messages
    const sanitizedMessages = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.slice(0, 2000) : "",
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...sanitizedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("speedo-bot error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});