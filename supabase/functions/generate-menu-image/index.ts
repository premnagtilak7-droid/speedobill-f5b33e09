import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      throw new Error("No prompt provided");
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    let lastStatus = 500;
    let lastErrorText = "Unknown Gemini error";

    for (const model of GEMINI_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a professional appetizing food photo of ${prompt}. Restaurant menu style, clean plating, realistic lighting, premium food photography, no text, no watermark, no collage.`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((part: { inlineData?: { mimeType?: string; data?: string } }) => part.inlineData?.data);

        if (!imagePart?.inlineData?.data) {
          console.error("Gemini response missing image:", JSON.stringify(data));
          return new Response(JSON.stringify({ error: "No image generated" }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            image_base64: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
            model_used: model,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(`Gemini API error [${model}]:`, response.status, lastErrorText);

      if (response.status === 404 || response.status === 410) {
        continue;
      }

      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: "Gemini image quota reached. Please wait a moment and try again, or increase your Google AI quota.",
          provider_status: 429,
          provider_details: lastErrorText,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        error: `Gemini API error: ${response.status}`,
        provider_details: lastErrorText,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "No supported Gemini image model is available for this API key right now.",
      provider_status: lastStatus,
      provider_details: lastErrorText,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-menu-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
