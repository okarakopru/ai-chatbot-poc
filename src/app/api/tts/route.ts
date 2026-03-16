import { NextRequest } from "next/server";

export const runtime = "nodejs";

// ElevenLabs — Roger voice (laid-back, casual)
const VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";
const XI_API_KEY = process.env.ELEVENLABS_API_KEY;

// Markdown işaretlerini temizle (TTS için düz metin)
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")   // bold
    .replace(/\*(.*?)\*/g, "$1")        // italic
    .replace(/`(.*?)`/g, "$1")          // inline code
    .replace(/#{1,6}\s/g, "")           // headings
    .replace(/>\s/g, "")                // blockquotes
    .replace(/\n{2,}/g, ". ")           // double newlines → pause
    .replace(/\n/g, " ")                // single newlines
    .trim();
}

export async function POST(req: NextRequest) {
  if (!XI_API_KEY) {
    return new Response(JSON.stringify({ error: "TTS not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanText = stripMarkdown(text).slice(0, 2500); // ElevenLabs free tier limit

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": XI_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs error:", err);
      return new Response(JSON.stringify({ error: "TTS failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream audio directly to client
    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
