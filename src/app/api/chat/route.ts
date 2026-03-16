import { NextRequest } from "next/server";

import { retrieveChunks, formatChunksForPrompt } from "../../../lib/rag";

import {
  recordChatStarted,
  recordMessage
} from "../../../lib/adminMetrics";

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

    const rawIp = extractClientIp(req.headers);

    if (!history || history.length <= 1) {
      recordChatStarted();

      const geo = await lookupGeo(rawIp);
      const location =
        [geo.city, geo.region, geo.country].filter(Boolean).join(", ") ||
        "Unknown";

      const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;

      await sendTelegramMessage(
        `🤖 *OrhanGPT — Yeni Sohbet*\n\n` +
        `💬 *İlk mesaj:* ${preview}\n\n` +
        `📍 *Lokasyon:* ${location}\n` +
        `🌐 *IP:* ${maskIp(rawIp)}\n` +
        `🕒 *Saat:* ${new Date().toLocaleTimeString("tr-TR")}`
      );
    }

    // Yüksek değerli anahtar kelime alarmı
    const HIGH_VALUE_KEYWORDS = [
      "iş teklifi", "job offer", "hiring", "işe almak", "recruit",
      "işbirliği", "collaboration", "partner", "ortaklık",
      "danışman", "consultant", "freelance", "proje teklifi",
      "maaş", "salary", "pozisyon", "position", "fırsat", "opportunity",
      "cv", "özgeçmiş", "resume", "mülakata", "interview"
    ];

    const msgLower = message.toLowerCase();
    const matchedKeyword = HIGH_VALUE_KEYWORDS.find(kw => msgLower.includes(kw));

    if (matchedKeyword) {
      const preview = message.length > 200 ? message.slice(0, 200) + "…" : message;
      await sendTelegramMessage(
        `🔥 *OrhanGPT — Yüksek Değerli Mesaj*\n\n` +
        `🎯 *Tetikleyen kelime:* \`${matchedKeyword}\`\n\n` +
        `💬 *Mesaj:* ${preview}\n\n` +
        `🌐 *IP:* ${maskIp(rawIp)}\n` +
        `🕒 *Saat:* ${new Date().toLocaleTimeString("tr-TR")}`
      );
    }

    // RAG: soruya özel ilgili chunk'ları getir
    const relevantChunks = retrieveChunks(message, 5);
    const contextBlock = formatChunksForPrompt(relevantChunks);

    const systemPrompt = `
You are OrhanGPT — the digital twin of Uğur Orhan Karaköprü.

You ARE Orhan. Not an assistant describing him. You speak as him, in first person.

---

## LANGUAGE RULE
- Default language: Turkish
- If the user writes in English, reply in English
- Mix Turkish and English naturally (e.g. "data-driven karar", "assumption'lar")

---

## PERSONALITY & TONE
- Samimi ve direkt. Lafı dolandırma, konuya gir.
- Biraz gamsız ama kafana koyduğun şeyler için sonuna kadar gidersin.
- Orta uzunlukta cevaplar ver — ne çok kısa ne gereksiz uzun.
- Emoji kullanma.
- Jargon kullanırsın ama doğal biçimde: "assumption", "north star metric", "data-driven".
- "Her şey harika" performansı yapma. Gerçek düşünceni söyle.
- Bilmediğin şeyi açıkça "bilmiyorum" diye belirt. İlginç bir konuysa "ama araştırırım" ekle.

---

## KESİN KURALLAR
- Aşağıdaki bilgi tabanında olmayan şeyleri UYDURMA. Bilmiyorsan söyle.
- CV listesi gibi madde madde cevap verme — konuşur gibi yaz.
- "Orhan şunu düşünüyor" deme — sen Orhan'sın, "ben şunu düşünüyorum" de.
- Aşırı uzun cevaplar yazma. 3-5 paragraf maksimum.

---

## İLGİLİ BİLGİ TABANI (soruya göre seçildi)
${contextBlock || "Genel sohbet — yukarıdaki kişilik kurallarına göre cevap ver."}
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

    recordMessage(Date.now() - t0, true, rawIp);

    return Response.json({ answer });
  } catch (error) {
    console.error("CHAT API ERROR:", error);
    recordMessage(Date.now() - t0, false, extractClientIp(req.headers));
    return Response.json(
      { answer: "Bir hata oluştu, lütfen tekrar dene." },
      { status: 500 }
    );
  }
}
