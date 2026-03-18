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

    // Build rich personality profile for deep AI reasoning
    const lifestyleDesc = personality.lifestyle === "home"
      ? "Evde vakit geçirmeyi sever; film, kitap, dinlenme ve huzurlu ortamlar onun için önemli."
      : personality.lifestyle === "outdoor"
      ? "Dışarı çıkmayı, seyahat etmeyi ve yeni deneyimler keşfetmeyi sever; evde durmaktan hoşlanmaz."
      : null;

    const giftStyleDesc = personality.giftStyle === "practical"
      ? "Hediyede pratiklik arar; her gün kullanacağı, hayatını kolaylaştıran şeyler onu mutlu eder."
      : personality.giftStyle === "sentimental"
      ? "Hediyenin arkasındaki düşünceye önem verir; anlam yüklü, kişisel dokunuşlu hediyeler daha çok heyecanlandırır."
      : null;

    const aestheticDesc = personality.aesthetic === "minimal"
      ? "Tarzı sade ve minimalist; gereksiz detaylardan kaçınır, temiz çizgileri ve işlevselliği sever."
      : personality.aesthetic === "luxury"
      ? "Kaliteli ve şık şeylerden hoşlanır; ince işçilik ve premium malzeme ona değer ifade eder."
      : null;

    const energyDesc = personality.energy === "calm"
      ? "Sakin ve içe dönük bir yapısı var; yoğunluktan çok huzur ve dinginlik arar."
      : personality.energy === "active"
      ? "Enerjik ve sosyal biri; aktif olmayı, bir şeyler üretmeyi ve hareket halinde olmayı sever."
      : null;

    const valueDesc = personality.valueType === "experience"
      ? "Deneyimlere ve anılara büyük değer verir; 'yaşanan an' eşyadan daha değerlidir ona göre."
      : personality.valueType === "item"
      ? "Somut ve kalıcı şeyler tercih eder; eline alıp her gün görebileceği, kullanabileceği hediyeler daha anlamlı gelir."
      : null;

    const profileLines = [lifestyleDesc, giftStyleDesc, aestheticDesc, energyDesc, valueDesc]
      .filter(Boolean)
      .map((line, i) => `${i + 1}. ${line}`)
      .join("\n");

    const occasionLabel = OCCASION_LABELS[occasion] || occasion;
    const relationLabel = RELATION_LABELS[recipient.relationship] || "yakını";
    const durationLabel = DURATION_LABELS[recipient.duration] || "";

    // Random seed forces the model to generate fresh results each call
    const sessionSeed = Math.random().toString(36).slice(2, 8).toUpperCase();

    const BLACKLIST = [
      "parfüm", "çikolata", "çiçek", "mum", "defter/ajanda", "kupa bardak",
      "takı seti", "makyaj paleti", "spor çantası", "kitap okuma lambası",
    ].join(", ");

    const prompt = `[Oturum: ${sessionSeed}] — Her oturumda farklı, taze öneriler üret.

${giverName}, ${durationLabel} ${recipient.name} adındaki ${relationLabel} için ${occasionLabel} vesilesiyle hediye arıyor.${recipient.age ? ` ${recipient.name} ${recipient.age} yaşında.` : ""}

${recipient.name}'in kişilik profili:
${profileLines || "Profil belirtilmemiş."}
${pastGifts ? `\nDaha önce verilen hediyeler: "${pastGifts}"\n⚠️ Bu ürünleri veya çok benzer kategorileri KESINLIKLE ÖNERME.` : ""}

Bu profili derinlemesine analiz et:
- ${recipient.name}'in günlük hayatı nasıl görünüyor?
- Kendisi almayacağı ama alınca çok sevineceklerine ne olabilir?
- ${occasionLabel} için bu kişiye özel ne anlam ifade eder?

20 hediye önerisi üret. Kriterler:
1. KLİŞELERDEN KAÇIN — şu tür önerileri ASLA verme: ${BLACKLIST}. Bunların yerine niş, spesifik, özgün ürünler bul.
2. En az 8 farklı kategori — her kategoride beklenmedik, özgün seçenekler tercih et
3. Fiyat çeşitliliği: 5 ürün ₺0–500, 7 ürün ₺500–1.500, 5 ürün ₺1.500–5.000, 3 ürün ₺5.000+
4. Türkiye'de Trendyol veya Hepsiburada'da gerçekten satılan, spesifik ürünler — genel kategori adı değil, somut ürün adı yaz
5. 20 önerinin en az 6'sı "ilk aklına gelen" değil, gerçekten düşünülmüş sürpriz öneri olsun
6. Her description: 1. cümle bu KİŞİYE neden özel olduğunu açıkla. 2. cümle somut kullanım senaryosu ver. "Harika hediye" gibi jenerik ifadeler kullanma.
7. buyUrl: Türkçe arama terimiyle oluştur — "https://www.trendyol.com/sr?q=turkce+urun+adi&sst=MOST_RATED" veya "https://www.hepsiburada.com/ara?q=turkce+urun+adi". q= parametresindeki kelimeler MUTLAKA Türkçe olsun.
8. imageKeywords: Pexels'te bu ürünü temsil eden İngilizce fotoğraf arama terimi (2-3 kelime, ürün fotoğrafçılığı tarzında). Örnekler: "leather journal notebook", "wireless earbuds white", "luxury perfume bottle". ASLA insan fotoğrafına yol açacak terimler kullanma.

⚠️ DİL KURALI: name, description ve category alanları ZORUNLU OLARAK TÜRKÇE olmalı. "Smart Watch", "Espresso Maker", "Camping Tent" gibi İngilizce ürün isimleri YASAK — bunları "Akıllı Saat", "Espresso Makinesi", "Kamp Çadırı" gibi Türkçe yaz. Sadece imageKeywords İngilizce olacak.

Sadece JSON döndür:
{"recommendations":[{"id":1,"name":"Türkçe ürün adı","description":"Kişiye özel 1-2 cümle Türkçe açıklama","price":"₺X – ₺Y.YYY","emoji":"tek-emoji","category":"türkçe kategori","imageKeywords":"english product photo term","buyUrl":"https://www.trendyol.com/sr?q=turkce+arama&sst=MOST_RATED","shop":"Trendyol"}]}`;

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
            content: `Sen dünyanın en iyi hediye danışmanısın. İnsanları derinden tanıyor ve onlara gerçekten özel, kişiselleştirilmiş hediye önerileri sunuyorsun. Önerilerinde "herkes için geçerli" jenerik ürünlerden kaçınırsın; her öneri alıcının kişiliğine, yaşam tarzına ve değerlerine özgü olmalı. Türkiye pazarını çok iyi biliyorsun. SADECE geçerli JSON döndür, başka hiçbir metin yazma.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.95,
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
    // Also fix buyUrl if AI used English name in the search query
    const productsWithImages = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products.map(async (p: any) => {
        const imageUrl = await fetchPexelsImage(p.imageKeywords || p.name);

        // Ensure buyUrl uses the Turkish product name, not whatever AI put in q=
        const safeName = encodeURIComponent((p.name || "").replace(/\s+/g, "+"));
        const fixedBuyUrl = p.shop === "Hepsiburada"
          ? `https://www.hepsiburada.com/ara?q=${safeName}`
          : `https://www.trendyol.com/sr?q=${safeName}&sst=MOST_RATED`;

        return { ...p, imageUrl, buyUrl: fixedBuyUrl };
      })
    );

    return NextResponse.json({ products: productsWithImages });
  } catch (err) {
    console.error("gift-recommendations error:", err);
    return NextResponse.json({ error: "Bir hata oluştu, lütfen tekrar deneyin" }, { status: 500 });
  }
}
