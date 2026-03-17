import { NextRequest } from "next/server";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
  if (!OPENAI_API_KEY) {
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

    const cleanText = stripMarkdown(text).slice(0, 4096); // OpenAI TTS limit

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",          // tts-1-hd daha kaliteli ama yavaş
        voice: "onyx",           // onyx: derin erkek sesi — en doğal
        input: cleanText,
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI TTS error:", res.status, err);
      return new Response(JSON.stringify({ error: "TTS failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await res.arrayBuffer();
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
