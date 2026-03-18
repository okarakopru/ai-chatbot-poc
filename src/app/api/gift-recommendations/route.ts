import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── Pexels image fetcher ────────────────────────────────────────────────────

async function fetchPexelsImage(keywords: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(keywords.replace(/,/g, " "));
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=portrait`,
      { headers: { Authorization: process.env.PEXELS_API_KEY! } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photos: { src: { large: string; medium: string } }[] = data.photos || [];
    if (photos.length === 0) return null;
    return photos[0].src.large || photos[0].src.medium || null;
  } catch {
    return null;
  }
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const OCCASION_LABELS: Record<string, string> = {
  birthday: "Doğum Günü",
  valentines: "Sevgililer Günü",
  anniversary: "Yıldönümü",
  newyear: "Yılbaşı",
  surprise: "Sebepsiz Sürpriz",
};


const RELATION_LABELS: Record<string, string> = {
  sevgilim: "sevgilisi",
  esim: "eşi",
  annem: "annesi",
  babam: "babası",
  arkadasim: "arkadaşı",
  kardesim: "kardeşi",
  diger: "yakını",
};

const DURATION_LABELS: Record<string, string> = {
  new: "yeni tanışıyorlar (henüz 6 aydan az)",
  medium: "6 ay – 1 yıldır birlikte",
  long: "1–3 yıldır birlikte",
  verylong: "3+ yıldır birlikte",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { giverName, recipient, personality, occasion, pastGifts } = body;

    // Build personality description
    const personalityParts: string[] = [];
    if (personality.lifestyle === "home") personalityParts.push("evde vakit geçirmeyi sever, iç mekân insanı");
    else if (personality.lifestyle === "outdoor") personalityParts.push("dışarı çıkmayı, seyahat etmeyi ve keşfetmeyi sever");

    if (personality.giftStyle === "practical") personalityParts.push("pratik ve işlevsel hediyeleri tercih eder");
    else if (personality.giftStyle === "sentimental") personalityParts.push("anlam yüklü ve duygusal hediyeleri tercih eder");

    if (personality.aesthetic === "minimal") personalityParts.push("minimalist ve sade bir tarzı var");
    else if (personality.aesthetic === "luxury") personalityParts.push("lüks ve kaliteli şeyleri sever");

    if (personality.energy === "calm") personalityParts.push("sakin ve dingin bir yapısı var");
    else if (personality.energy === "active") personalityParts.push("aktif ve enerjik biri");

    if (personality.valueType === "experience") personalityParts.push("deneyimlere ve anılara büyük değer verir");
    else if (personality.valueType === "item") personalityParts.push("somut ürünleri ve eşyaları tercih eder");

    const personalityText = personalityParts.join("; ");

    const prompt = `Sen bir uzman hediye danışmanısın. Verilen profile göre 20 adet kişiselleştirilmiş hediye önerisi üret.

ALICI PROFİLİ:
- Hediye veren: ${giverName}
- Alıcı: ${recipient.name} (${giverName}'in ${RELATION_LABELS[recipient.relationship] || "yakını"}, ${DURATION_LABELS[recipient.duration] || ""})${recipient.age ? `\n- Yaşı: ${recipient.age}` : ""}
- Kişilik: ${personalityText || "belirtilmemiş"}
- Özel gün: ${OCCASION_LABELS[occasion] || occasion}${pastGifts ? `\n- Daha önce alınan hediyeler: "${pastGifts}" — bunları TEKRAR ÖNERME, benzer kategorilerden de kaçın` : ""}

KURALLAR:
1. En az 6 farklı kategoride öneriler sun (güzellik/kozmetik, teknoloji/elektronik, deneyim, aksesuar/moda, kitap/hobi, yaşam tarzı, spor, seyahat, yemek/içecek)
2. Fiyat dağılımı: ~5 ürün 0–500₺, ~7 ürün 500–1.500₺, ~5 ürün 1.500–5.000₺, ~3 ürün 5.000₺+ — böylece kullanıcı kendi bütçesine göre filtreleyebilsin
3. Türkiye'de Trendyol veya Hepsiburada'da gerçekten bulunabilecek, gerçekçi ürünler öner — hayali ürün uydurma
4. buyUrl: Trendyol veya Hepsiburada arama URL'si — Format: "https://www.trendyol.com/sr?q=urun+adi&sst=MOST_RATED" veya "https://www.hepsiburada.com/ara?q=urun+adi"
5. imageKeywords: Flickr'da ürünü DOĞRU temsil eden fotoğrafı bulacak İngilizce anahtar kelimeler (3-4 kelime, virgülle ayrılmış). Dikkat: "sunscreen" için "sunscreen,beach,spf,bottle" gibi spesifik ol — yanlış fotoğrafa yol açacak genel kelimeler kullanma
6. Her önerinin description'ında neden bu kişiye uyduğunu 1-2 cümleyle belirt

Sadece JSON döndür, başka açıklama yazma:
{"recommendations":[{"id":1,"name":"Türkçe ürün adı","description":"Bu kişiye neden uyduğunu açıklayan 1-2 cümle","price":"₺X – ₺Y.YYY","emoji":"tek-emoji","category":"kategori","imageKeywords":"english,product,photo,keywords","buyUrl":"https://www.trendyol.com/sr?q=...","shop":"Trendyol"}]}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Sen bir hediye danışmanısın. SADECE geçerli JSON döndür. Başka hiçbir metin, açıklama veya markdown yazma.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI API error:", errText);
      return NextResponse.json({ error: "AI servisi yanıt vermedi" }, { status: 500 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || "{}";

    let parsed: { recommendations?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("JSON parse failed:", content.slice(0, 200));
      return NextResponse.json({ error: "AI yanıtı işlenemedi" }, { status: 500 });
    }

    const products = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    if (products.length === 0) {
      return NextResponse.json({ error: "Ürün önerisi alınamadı" }, { status: 500 });
    }

    // Fetch real product photos from Pexels in parallel
    const productsWithImages = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products.map(async (p: any) => {
        const imageUrl = await fetchPexelsImage(p.imageKeywords || p.name);
        return { ...p, imageUrl };
      })
    );

    return NextResponse.json({ products: productsWithImages });
  } catch (err) {
    console.error("gift-recommendations error:", err);
    return NextResponse.json({ error: "Bir hata oluştu, lütfen tekrar deneyin" }, { status: 500 });
  }
}
