# OrhanGPT — Dijital İkiz

**[orhankarakopru.com.tr](https://orhankarakopru.com.tr)**

Uğur Orhan Karaköprü'nün AI destekli dijital ikizi. Ziyaretçiler Orhan hakkında soru sorabilir; sistem birinci şahıs olarak, Orhan'ın sesi ve bakış açısıyla yanıt verir.

---

## Özellikler

- **Dijital İkiz Persona** — GPT-4o-mini, Orhan olarak konuşur (asistan değil, birinci şahıs)
- **Semantik RAG** — Sorguya göre ilgili bilgi parçaları cosine similarity ile seçilir; embedding yoksa keyword araması devreye girer
- **Uzun Süreli Hafıza** — Upstash Redis ile ziyaretçi bazında cross-session hafıza (30 gün TTL)
- **Telegram Bildirimleri** — Yeni sohbet başladığında ve yüksek değerli kelimeler (iş teklifi, interview, işbirliği) algılandığında anlık bildirim
- **CTA Kartı** — Yüksek değerli konularda cevabın altında LinkedIn ve e-posta butonları çıkar
- **Ses Katmanı** — OpenAI TTS ile asistan cevapları sesli dinlenebilir
- **Rate Limiting** — Dakikada 15 mesaj / IP (in-memory)
- **OG Meta** — LinkedIn/WhatsApp paylaşımında profil önizlemesi

---

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| AI | OpenAI GPT-4o-mini + text-embedding-3-small |
| TTS | OpenAI TTS (onyx voice) |
| Hafıza | Upstash Redis REST API |
| Bildirim | Telegram Bot API |
| Stil | Tailwind CSS v4 |
| Deploy | Render (auto-deploy on push) |

---

## Proje Yapısı

```
src/
├── app/
│   ├── page.tsx              # Ana chat UI
│   ├── layout.tsx            # OG meta, font
│   ├── admin/page.tsx        # Admin dashboard
│   └── api/
│       ├── chat/route.ts     # Ana chat endpoint (RAG + hafıza + Telegram)
│       └── tts/route.ts      # Text-to-speech endpoint
├── lib/
│   ├── rag.ts                # Semantik RAG (embedding + cosine similarity)
│   ├── memory.ts             # Upstash Redis uzun süreli hafıza
│   ├── telegram.ts           # Telegram bildirim yardımcısı
│   ├── geo.ts                # IP lokasyon (ipapi.co)
│   └── adminMetrics.ts       # In-memory metrik toplama
├── data/
│   ├── orhan.chunks.json     # 20 bilgi parçası (kariyer, AI görüşleri, vb.)
│   ├── orhan.embeddings.json # Önceden hesaplanmış embedding vektörleri
│   ├── orhan.profile.json    # Temel profil
│   ├── orhan.opinions.json   # Fikir ve görüşler
│   └── orhan.faq.json        # 11 sık sorulan soru
└── scripts/
    └── buildEmbeddings.mjs   # Embedding yenileme scripti
```

---
