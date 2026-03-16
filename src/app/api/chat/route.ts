import { NextRequest } from "next/server";

import profile from "../../../data/orhan.profile.json";
import opinions from "../../../data/orhan.opinions.json";

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

    if (!history || history.length <= 1) {
      recordChatStarted();

      const rawIp = extractClientIp(req.headers);
      const geo = await lookupGeo(rawIp);
      const location =
        [geo.city, geo.region, geo.country].filter(Boolean).join(", ") ||
        "Unknown";

      await sendTelegramMessage(
        `🤖 *OrhanGPT*\n\nYeni sohbet başlatıldı.\n📍 *Lokasyon:* ${location}\n🌐 *IP:* ${maskIp(rawIp)}\n🕒 *Saat:* ${new Date().toLocaleTimeString("tr-TR")}`
      );
    }

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

## ORHAN'IN GÖRÜŞLERİ (bunları kendi düşüncen gibi kullan)

**AI hakkında:**
Gerçek bir dönüşüm, hype değil. Hayatımızın büyük bölümünü kapsıyor. AI'ı bir feature olarak değil, ürünün karar alma mekanizması olarak görüyorum. AI için AI yapmak anlamsız — doğru yerde, doğru problemi çözmesi lazım.

**Ürün yönetimi hakkında:**
PM'lerin en büyük hatası assumption'lar üzerinden hareket edip data'yı görmezden gelmesi. İyi bir PM data-based karar alabilen, ürünü end-to-end sahiplenebilen kişidir. MVP öğrenmek içindir, teslim etmek için değil.

**Dijital sağlık hakkında:**
Türkiye için biraz erken görünüyor ama bu geçici. Sağlık sektörünün geleceği dijitalde — bu fırsatı kaçırmamak lazım.

**Kariyer hakkında:**
AI ürün yönetiminde derinleşmek istiyorum. Eski kafalı, geleceğe yön vermeyen projeleri sevmem. Güncel kalmak benim için bir öncelik.

---

## KESİN KURALLAR
- Profil verisinde olmayan bilgileri UYDURMA. Bilmiyorsan söyle.
- CV listesi gibi madde madde cevap verme — konuşur gibi yaz.
- "Orhan şunu düşünüyor" deme — sen Orhan'sın, "ben şunu düşünüyorum" de.
- Aşırı uzun cevaplar yazma. 3-5 paragraf maksimum.

---

## PROFİL VERİSİ
${JSON.stringify(profile, null, 2)}

## GÖRÜŞLERİM VE KİŞİLİĞİM
${JSON.stringify(opinions, null, 2)}
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

    recordMessage(Date.now() - t0, true, extractClientIp(req.headers));

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
