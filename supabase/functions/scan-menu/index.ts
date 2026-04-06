import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\[\{]/);
  const lastBracket = cleaned.lastIndexOf("]");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonEnd = Math.max(lastBracket, lastBrace);

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON found in response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // If the token is just the anon key, allow (public endpoint behind app auth)
    if (token !== anonKey) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await callerClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Request validation ──
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Request too large (max 5MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image_base64 } = await req.json();
    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit base64 size (~5MB)
    if (image_base64.length > 7_000_000) {
      return new Response(JSON.stringify({ error: "Image too large (max ~5MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = image_base64.replace(/^data:image\/[a-z]+;base64,/, "");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract ALL menu items from this image. For each item, detect if there are multiple price variants (like Half, Full, Quarter, Piece, Plate, Small, Medium, Large, Regular).

Return ONLY a valid JSON array. Each object must have:
- "name": string (item name)
- "category": string (like "Main Course", "Starters", "Desserts", "Beverages", "Snacks", "Thali", "Rice", "Roti/Bread", etc.)
- "price": number (the base/default price in INR, use the first or lowest price)
- "price_variants": array of {"label": string, "price": number} if multiple sizes/variants exist, otherwise null

Example: [{"name":"Paneer Tikka","category":"Starters","price":180,"price_variants":[{"label":"Half","price":180},{"label":"Full","price":320}]}]

No markdown, no explanation, ONLY the JSON array.`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed: any;
    try {
      parsed = extractJsonFromResponse(text);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse menu items from AI response" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawItems = Array.isArray(parsed) ? parsed : [parsed];
    const items = rawItems
      .filter((i: any) => i.name && (i.price || i.price_variants?.length))
      .slice(0, 500) // Cap at 500 items
      .map((i: any) => ({
        name: String(i.name).trim().slice(0, 200),
        price: Math.max(0, Math.min(999999, Number(i.price) || (i.price_variants?.[0]?.price || 0))),
        category: String(i.category || "General").trim().slice(0, 100),
        price_variants: Array.isArray(i.price_variants) && i.price_variants.length > 0
          ? i.price_variants.slice(0, 10).map((v: any) => ({
              label: String(v.label).slice(0, 50),
              price: Math.max(0, Math.min(999999, Number(v.price))),
            }))
          : null,
      }));

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-menu error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});