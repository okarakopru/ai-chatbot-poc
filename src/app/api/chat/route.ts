import { NextRequest } from "next/server";

import { retrieveChunks, formatChunksForPrompt } from "../../../lib/rag";
import { loadMemory, saveMemory, formatMemoryForPrompt } from "../../../lib/memory";

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

// ── Dil tespiti (sunucu tarafı — GPT'ye bırakmıyoruz) ─────────────────────
function detectLanguage(text: string): "en" | "tr" {
  // Türkçe'ye özgü karakterler varsa kesinlikle Türkçe
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(text)) return "tr";
  // Yaygın Türkçe kelimeler
  const TR_WORDS = new Set([
    "ve","bir","bu","da","de","mi","mı","mu","mü","için","ile","ne","nasıl",
    "neden","kim","nerede","sen","ben","biz","siz","ama","fakat","gibi",
    "kadar","çok","daha","en","var","yok","iş","para","zaman","hakkında",
    "yapıyordun","yapıyorsun","neydi","nedir","olur","değil","olan","olan",
    "ama","veya","ya","ki","ise","ile","olan","hangi","her","hiç",
  ]);
  const words = text.toLowerCase().split(/\s+/);
  if (words.some((w) => TR_WORDS.has(w))) return "tr";
  return "en";
}

// ── Rate limiting (in-memory, dakikada 15 mesaj / IP) ──────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const WINDOW = 60_000; // 1 dakika
  const MAX = 15;
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW });
    return false;
  }
  if (entry.count >= MAX) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

    const rawIp = extractClientIp(req.headers);

    if (isRateLimited(rawIp)) {
      return Response.json(
        { answer: "Çok hızlı mesaj gönderiyorsun. Bir dakika bekleyip tekrar dener misin?" },
        { status: 200 }
      );
    }

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
        `📍 *Ziyaretçi Lokasyonu:* ${location}\n` +
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
      "cv", "özgeçmiş", "resume",
      "mülakat", "mülakata", "mülakatı", "interview",
      "iş görüşmesi", "görüşme", "iş başvurusu", "başvuru",
      "ulaşabilirim", "iletişim", "contact", "reach out"
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

    // Uzun süreli hafıza — paralel yükle
    const replyLang = detectLanguage(message);

    const [relevantChunks, pastMemory] = await Promise.all([
      retrieveChunks(message, 5),
      loadMemory(rawIp),
    ]);
    const contextBlock = formatChunksForPrompt(relevantChunks);
    const memoryBlock = pastMemory ? formatMemoryForPrompt(pastMemory) : null;

    const systemPrompt = `
You are OrhanGPT — the digital twin of Uğur Orhan Karaköprü.

You ARE Orhan. Not an assistant describing him. You speak as him, in first person.

---

## LANGUAGE — MANDATORY
REPLY LANGUAGE: ${replyLang === "en" ? "ENGLISH ONLY. Do not use any Turkish words." : "TURKISH. Teknik jargon (data-driven, north star, assumption) Türkçe cümleler içinde kullanılabilir."}

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
${memoryBlock ? `\n## GEÇMİŞ SOHBET BAĞLAMI\n${memoryBlock}` : ""}
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

    // OpenAI bazen HTML hata sayfası döner (Cloudflare 502 vb.) — JSON parse'ı güvenli yap
    let answer = "Şu anda bu soruya cevap veremiyorum.";
    if (res.ok) {
      try {
        const data = await res.json();
        answer = data?.choices?.[0]?.message?.content ?? answer;
      } catch {
        console.error("OpenAI JSON parse error, status:", res.status);
      }
    } else {
      console.error("OpenAI non-OK response:", res.status, res.statusText);
    }

    recordMessage(Date.now() - t0, true, rawIp);

    // Hafızayı güncelle (fire & forget — yanıtı bloklamaz)
    saveMemory(rawIp, [...history, { role: "user", content: message }], pastMemory).catch(() => {});

    return Response.json({ answer, showCTA: !!matchedKeyword });
  } catch (error) {
    console.error("CHAT API ERROR:", error instanceof Error ? error.message : error);
    recordMessage(Date.now() - t0, false, extractClientIp(req.headers));
    return Response.json(
      { answer: "Şu an bir sorun var, birkaç saniye sonra tekrar dener misin?" },
      { status: 200 }
    );
  }
}
