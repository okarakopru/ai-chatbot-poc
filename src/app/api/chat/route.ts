import { NextRequest } from "next/server";

// Profile data
import profile from "../../../data/orhan.profile.json";

// Admin metrics
import {
  recordChatStarted,
  recordMessage
} from "../../../lib/adminMetrics";

// Telegram & Geo helpers
import { sendTelegramMessage } from "../../../lib/telegram";
import {
  extractClientIp,
  lookupGeo,
  maskIp
} from "../../../lib/geo";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

    // İlk mesaj = yeni sohbet
    if (!history || history.length <= 1) {
      recordChatStarted();

      const rawIp = extractClientIp(req.headers);
      const geo = await lookupGeo(rawIp);

      const location =
        [geo.city, geo.region, geo.country]
          .filter(Boolean)
          .join(", ") || "Unknown";

      await sendTelegramMessage(
        `🤖 *OrhanGPT*\n\nYeni sohbet başlatıldı.\n📍 *Lokasyon:* ${location}\n🌐 *IP:* ${maskIp(rawIp)}\n🕒 *Saat:* ${new Date().toLocaleTimeString("tr-TR")}`
      );
    }

    const systemPrompt = `
You are OrhanGPT, the personal AI assistant of Uğur Orhan Karaköprü.

You must respond AS IF YOU ARE ORHAN KARAKÖPRÜ HIMSELF.
Use first-person language in Turkish ("ben", "çalışıyorum", "deneyimim var").
Use Turkish as default but understand the message language and reply with that language. For example if message is in English, reply in English.

Tone & style:
- Speak naturally, like a real conversation.
- Use **bold text** for emphasis when appropriate.
- Prefer short paragraphs.
- Avoid CV-style listing unless explicitly asked.

Factual rules:
- Base your answers ONLY on the profile data below.
- Do NOT invent information.
- If something is unknown, say so clearly.

PROFILE DATA:
${JSON.stringify(profile, null, 2)}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages
      })
    });

    const data = await res.json();

    const answer =
      data?.choices?.[0]?.message?.content ??
      "Şu anda bu soruya cevap veremiyorum.";

    // Başarılı mesaj metriği
    recordMessage(Date.now() - t0, true, extractClientIp(req.headers));

    return Response.json({ answer });

  } catch (error) {
    console.error("CHAT API ERROR:", error);

    // Hata metriği
    recordMessage(Date.now() - t0, false, extractClientIp(req.headers));

    return Response.json(
      { answer: "Bir hata oluştu, lütfen tekrar dene." },
      { status: 500 }
    );
  }
}
