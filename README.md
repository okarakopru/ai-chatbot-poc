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
- **Admin Dashboard** — `/admin` sayfasında sohbet ve mesaj istatistikleri
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
| Auth | next-auth (admin panel) |

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

## Ortam Değişkenleri

```env
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
ADMIN_KEY=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## Geliştirme

```bash
cd src
npm install
npm run dev
```

Embedding'leri yenilemek için (chunks değiştiğinde):

```bash
cd src
OPENAI_API_KEY=sk-... npm run embeddings
```

---

## Deploy

Render üzerinde `main` branch'e push yapıldığında otomatik deploy edilir.
Build komutu: `npm install && npm run build`
Start komutu: `npm start`
Root directory: `src`
