import { NextRequest } from "next/server";

export const runtime = "nodejs";

// ElevenLabs — Roger voice (laid-back, casual)
// Render env'de ELEVENLABS_VOICE_ID set edilerek değiştirilebilir
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "CwhRBWXzGAHq8TQ4Fs17";
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

    // /stream yerine direkt endpoint — ücretsiz planda daha güvenilir
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": XI_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_turbo_v2_5", // hızlı + tüm planlarda mevcut
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs error:", res.status, err);
      return new Response(JSON.stringify({ error: "TTS failed", status: res.status }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Buffer audio — stream passthrough Node.js'te güvenilmez
    const audioBuffer = await res.arrayBuffer();
    if (audioBuffer.byteLength === 0) {
      console.error("ElevenLabs returned empty audio buffer");
      return new Response(JSON.stringify({ error: "Empty audio" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
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
