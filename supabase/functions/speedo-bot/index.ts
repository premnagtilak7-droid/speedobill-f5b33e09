const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    const body = await req.json().catch(() => null);
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return json({ error: "Invalid messages" }, 400);
    }

    const sanitizedMessages = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.slice(0, 2000) : "",
    })).filter((message) => message.content.trim().length > 0);

    if (sanitizedMessages.length === 0) {
      return json({ error: "Invalid messages" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return json({ error: "Gemini API key not configured" }, 500);
    }

    // Convert OpenAI-style messages to Gemini contents format
    const contents = sanitizedMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Gemini API error:", response.status, details);
      if (response.status === 429) {
        return json({ error: "Too many requests. Please wait a moment." }, 429);
      }
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return json({ error: "Invalid Gemini API key. Update GEMINI_API_KEY secret." }, 401);
      }
      return json({ error: "AI service unavailable" }, 500);
    }

    if (!response.body) {
      return json({ error: "No AI response stream returned" }, 500);
    }

    // Transform Gemini SSE stream into OpenAI-compatible chat.completions SSE chunks
    // so the existing frontend (which parses choices[0].delta.content) keeps working.
    const transformed = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const obj = JSON.parse(payload);
                const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const chunk = { choices: [{ delta: { content: text } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {
                // ignore parse errors on partial frames
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("stream transform error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformed, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("speedo-bot error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});