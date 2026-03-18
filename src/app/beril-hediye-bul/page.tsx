"use client";

import { useState, useRef, useCallback } from "react";

type Occasion = "birthday" | "valentines" | "anniversary" | "newyear" | "surprise";
type Category = "travel" | "book" | "music" | "cosmetic" | "sport" | "lifestyle";

type Product = {
  id: number;
  name: string;
  description: string;
  price: string;
  emoji: string;
  gradient: string;
  category: Category;
  occasions: Occasion[];
  buyUrl: string;
  shop: string;
};

const OCCASIONS = [
  { id: "birthday" as Occasion, label: "Doğum Günü", emoji: "🎂", desc: "Yıllık özel gün" },
  { id: "valentines" as Occasion, label: "Sevgililer Günü", emoji: "💕", desc: "14 Şubat" },
  { id: "anniversary" as Occasion, label: "Yıldönümü", emoji: "💍", desc: "İlişki yıldönümü" },
  { id: "newyear" as Occasion, label: "Yılbaşı", emoji: "🎉", desc: "Yeni yıl hediyesi" },
  { id: "surprise" as Occasion, label: "Sürpriz", emoji: "🎁", desc: "Sebepsiz sürpriz" },
];

const CATEGORY_LABELS: Record<Category, string> = {
  travel: "Seyahat",
  book: "Kitap",
  music: "Müzik",
  cosmetic: "Güzellik",
  sport: "Spor & Aktif",
  lifestyle: "Yaşam Tarzı",
};

const ALL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Deri Pasaport Cüzdanı",
    description: "Seyahatin vazgeçilmezi — şık ve kaliteli deri pasaport kılıfı. Her yolculukta yanında.",
    price: "₺299 – ₺599",
    emoji: "🛂",
    gradient: "from-amber-800 via-amber-700 to-orange-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=deri+pasaport+c%C3%BCzdan%C4%B1&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 2,
    name: "Seyahat Organizeri Seti",
    description: "Bavulunu düzenli tutan kompakt organizer seti. Artık her şeyin bir yeri var.",
    price: "₺399 – ₺799",
    emoji: "🧳",
    gradient: "from-blue-800 via-blue-700 to-indigo-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+organizer+set&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 3,
    name: "Seyahat & Anı Günlüğü",
    description: "Gidilen her yeri, yaşanan her anı kaydetmek için özel tasarım defter.",
    price: "₺199 – ₺449",
    emoji: "📔",
    gradient: "from-emerald-800 via-teal-700 to-green-700",
    category: "travel",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+an%C4%B1+g%C3%BCnl%C3%BC%C4%9F%C3%BC&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 4,
    name: "Taşınabilir Powerbank",
    description: "Seyahatte şarj stresi yok. Yüksek kapasiteli, slim tasarım şarj cihazı.",
    price: "₺599 – ₺1.299",
    emoji: "🔋",
    gradient: "from-slate-700 via-slate-600 to-gray-600",
    category: "travel",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=powerbank+20000mah",
    shop: "Hepsiburada",
  },
  {
    id: 5,
    name: "Memory Foam Boyun Yastığı",
    description: "Uzun yolculuklarda boyun ağrısına elveda. Premium memory foam konforu.",
    price: "₺399 – ₺899",
    emoji: "🌙",
    gradient: "from-purple-800 via-violet-700 to-purple-700",
    category: "travel",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+boyun+yast%C4%B1%C4%9F%C4%B1+memory+foam&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 6,
    name: "Kindle Paperwhite",
    description: "Seyahat + kitap = mükemmel ikili. Binlerce kitap tek cihazda, gözü yormayan ekran.",
    price: "₺3.999 – ₺5.499",
    emoji: "📚",
    gradient: "from-gray-700 via-gray-600 to-zinc-600",
    category: "book",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=kindle+paperwhite",
    shop: "Hepsiburada",
  },
  {
    id: 7,
    name: "Premium Deri Kitap Ayracı Seti",
    description: "Okuyan biri için ideal, kişiselleştirilebilir zarif deri yer imi seti.",
    price: "₺149 – ₺299",
    emoji: "🔖",
    gradient: "from-orange-800 via-amber-700 to-orange-700",
    category: "book",
    occasions: ["valentines", "surprise", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=deri+kitap+ayrac%C4%B1+ki%C5%9Fisel&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 8,
    name: "Kitap Paketi Hediye Seti",
    description: "Sevilen yazarlardan seçilmiş 3-5 kitap + şık kutu ambalaj. Tam sürpriz.",
    price: "₺599 – ₺1.299",
    emoji: "📖",
    gradient: "from-rose-800 via-rose-700 to-pink-700",
    category: "book",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=kitap+hediye+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 9,
    name: "Gürültü Önleyici Kablosuz Kulaklık",
    description: "Seyahatte müzikle uçmak için ANC özellikli premium kablosuz kulaklık.",
    price: "₺1.999 – ₺4.999",
    emoji: "🎧",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "music",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=anc+kablosuz+kulakl%C4%B1k&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 10,
    name: "Su Geçirmez Bluetooth Hoparlör",
    description: "Plajda, seyahatte, her yerde müzik. Su geçirmez, kompakt ve şık.",
    price: "₺999 – ₺2.499",
    emoji: "🔊",
    gradient: "from-cyan-800 via-cyan-700 to-sky-700",
    category: "music",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=bluetooth+hoparlör+su+geçirmez+taşınabilir",
    shop: "Hepsiburada",
  },
  {
    id: 11,
    name: "Spotify / Apple Music Hediye Kartı",
    description: "12 aylık reklamsız, sınırsız müzik keyfi. Anında teslim, hemen aktif.",
    price: "₺799 – ₺999",
    emoji: "🎵",
    gradient: "from-green-800 via-emerald-700 to-green-700",
    category: "music",
    occasions: ["birthday", "valentines", "surprise", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=spotify+hediye+kart%C4%B1",
    shop: "Hepsiburada",
  },
  {
    id: 12,
    name: "Niche Parfüm",
    description: "Kimsenin taşımadığı, kalıcı ve özel bir koku. Lüks hediye kutusuyla.",
    price: "₺1.499 – ₺3.999",
    emoji: "🌸",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=niche+parf%C3%BCm+kad%C4%B1n&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 13,
    name: "Premium Cilt Bakım Seti",
    description: "Seyahat boyutlu, premium marka cilt bakım rutini. Her seyahatin olmazsa olmazı.",
    price: "₺899 – ₺2.499",
    emoji: "✨",
    gradient: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=cilt+bak%C4%B1m+seti+premium+set&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 14,
    name: "Saç Bakım Ritüel Seti",
    description: "Seyahatte bile salon çıkışlı görünüm. Lüks saç bakım seti.",
    price: "₺699 – ₺1.799",
    emoji: "💆‍♀️",
    gradient: "from-lime-800 via-lime-700 to-green-700",
    category: "cosmetic",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=sac+bakim+seti+premium",
    shop: "Hepsiburada",
  },
  {
    id: 15,
    name: "SPF 50+ Güneş Koruyucu Set",
    description: "Seyahatin vazgeçilmezi. Yüz + vücut için premium güneş koruma seti.",
    price: "₺399 – ₺999",
    emoji: "☀️",
    gradient: "from-yellow-700 via-amber-600 to-yellow-700",
    category: "cosmetic",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=spf+50+güneş+koruyucu+set&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 16,
    name: "Premium Yoga Matı",
    description: "Kaymaz yüzey, 6mm kalınlık. Sporty yaşamın şık ve işlevsel aksesuarı.",
    price: "₺599 – ₺1.299",
    emoji: "🧘‍♀️",
    gradient: "from-teal-800 via-teal-700 to-emerald-700",
    category: "sport",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+yoga+mat%C4%B1&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 17,
    name: "Akıllı Saat / Fitness Tracker",
    description: "Adım, nabız, uyku takibi — hepsi bileğinde. Sporty yaşamın teknolojik dostu.",
    price: "₺2.499 – ₺5.999",
    emoji: "⌚",
    gradient: "from-indigo-800 via-indigo-700 to-blue-700",
    category: "sport",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=fitness+tracker+akıllı+saat+kadın",
    shop: "Hepsiburada",
  },
  {
    id: 18,
    name: "Premium Termos Matara",
    description: "24 saat soğuk, 12 saat sıcak. Seyahat ve spor için şık, dayanıklı matara.",
    price: "₺499 – ₺1.099",
    emoji: "💧",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "sport",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+termos+matara&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 19,
    name: "Spa & Wellness Deneyimi",
    description: "Tüm gün spa paketi — hamam, masaj, sauna. Dinlenmenin en güzel hali.",
    price: "₺999 – ₺2.499",
    emoji: "🛁",
    gradient: "from-stone-700 via-stone-600 to-zinc-600",
    category: "lifestyle",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=spa+hediye+deneyimi+masaj&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 20,
    name: "Online Dil Kursu Aboneliği",
    description: "Seyahat tutkunuyla mükemmel uyum. İspanyolca, İtalyanca, Portekizce — seçim sende.",
    price: "₺999 – ₺2.999",
    emoji: "🌍",
    gradient: "from-red-800 via-red-700 to-rose-700",
    category: "lifestyle",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=online+dil+kursu+abonelik",
    shop: "Hepsiburada",
  },
  {
    id: 21,
    name: "Aromalı Premium Mum Seti",
    description: "Evde şehir kaçamağı. El yapımı, soya balmumu premium mum koleksiyonu.",
    price: "₺349 – ₺799",
    emoji: "🕯️",
    gradient: "from-amber-900 via-amber-800 to-orange-800",
    category: "lifestyle",
    occasions: ["valentines", "birthday", "surprise", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+aroma+mum+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 22,
    name: "Kişiselleştirilmiş Takı",
    description: "Adı veya özel tarihi yazılan zarif bileklik ya da kolye. Ona özel.",
    price: "₺499 – ₺1.599",
    emoji: "💎",
    gradient: "from-rose-900 via-rose-800 to-pink-800",
    category: "lifestyle",
    occasions: ["valentines", "anniversary", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=ki%C5%9Fisel+isimli+tak%C4%B1+bileklik&sst=MOST_RATED",
    shop: "Trendyol",
  },
];

type SwipeDirection = "left" | "right" | null;

export default function BerilHediyeBul() {
  const [step, setStep] = useState<"occasion" | "swipe" | "results">("occasion");
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<Product[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeDirection>(null);

  const dragStartX = useRef(0);

  function startOccasion(occasion: Occasion) {
    const filtered = ALL_PRODUCTS.filter((p) => p.occasions.includes(occasion));
    setSelectedOccasion(occasion);
    setProducts(filtered);
    setCurrentIndex(0);
    setLiked([]);
    setStep("swipe");
  }

  const swipe = useCallback(
    (dir: SwipeDirection) => {
      if (!dir || currentIndex >= products.length) return;
      setSwipeFeedback(dir);
      if (dir === "right") {
        setLiked((prev) => [...prev, products[currentIndex]]);
      }
      setTimeout(() => {
        setSwipeFeedback(null);
        setDragX(0);
        const next = currentIndex + 1;
        setCurrentIndex(next);
        if (next >= products.length) {
          setStep("results");
        }
      }, 300);
    },
    [currentIndex, products]
  );

  // Mouse events
  function onMouseDown(e: React.MouseEvent) {
    dragStartX.current = e.clientX;
    setDragging(true);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setDragX(e.clientX - dragStartX.current);
  }
  function onMouseUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragX > 80) swipe("right");
    else if (dragX < -80) swipe("left");
    else setDragX(0);
  }

  // Touch events
  function onTouchStart(e: React.TouchEvent) {
    dragStartX.current = e.touches[0].clientX;
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    setDragX(e.touches[0].clientX - dragStartX.current);
  }
  function onTouchEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dragX > 80) swipe("right");
    else if (dragX < -80) swipe("left");
    else setDragX(0);
  }

  const cardRotation = swipeFeedback
    ? swipeFeedback === "right"
      ? 15
      : -15
    : dragX * 0.1;
  const cardTranslateX = swipeFeedback
    ? swipeFeedback === "right"
      ? 400
      : -400
    : dragX;
  const likeOpacity = Math.min(1, Math.max(0, (dragX > 0 ? dragX : 0) / 60));
  const passOpacity = Math.min(1, Math.max(0, (dragX < 0 ? -dragX : 0) / 60));

  const currentProduct = products[currentIndex];
  const nextProduct = products[currentIndex + 1];
  const progress = products.length > 0 ? (currentIndex / products.length) * 100 : 0;
  const occasionLabel = OCCASIONS.find((o) => o.id === selectedOccasion)?.label ?? "";

  // Group liked by category
  const likedByCategory = liked.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center">
      {/* Header */}
      <header className="w-full sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40">Beril için hediye bul</p>
            <h1 className="text-sm font-semibold text-white">
              {step === "occasion" && "Hangi özel gün? 🎁"}
              {step === "swipe" && `${occasionLabel} için hediyeler`}
              {step === "results" && "Hediye listesi hazır!"}
            </h1>
          </div>
          {step !== "occasion" && (
            <button
              onClick={() => {
                setStep("occasion");
                setDragX(0);
                setSwipeFeedback(null);
              }}
              className="text-[11px] text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-md transition-all"
            >
              Yeniden Başla
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg px-4 py-6 flex flex-col">

        {/* ── STEP 1: Occasion Selection ── */}
        {step === "occasion" && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">💝</div>
              <h2 className="text-xl font-bold text-white mb-1">Berkay, merhaba!</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Beril'e doğru hediyeyi bulalım. Hangi özel gün için arıyorsun?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ.id}
                  onClick={() => startOccasion(occ.id)}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/20 rounded-2xl px-5 py-4 transition-all text-left group"
                >
                  <span className="text-3xl">{occ.emoji}</span>
                  <div>
                    <p className="font-semibold text-white text-sm group-hover:text-white transition-colors">
                      {occ.label}
                    </p>
                    <p className="text-xs text-white/40">{occ.desc}</p>
                  </div>
                  <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors text-lg">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Swipe ── */}
        {step === "swipe" && currentProduct && (
          <div className="flex flex-col items-center gap-5 select-none">
            {/* Progress */}
            <div className="w-full flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-white/30 shrink-0">
                {currentIndex + 1} / {products.length}
              </span>
            </div>

            {/* Card stack */}
            <div className="relative w-full" style={{ height: 460 }}>
              {/* Background card (next) */}
              {nextProduct && (
                <div
                  className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${nextProduct.gradient} border border-white/10`}
                  style={{ transform: "scale(0.95) translateY(12px)", zIndex: 0, opacity: 0.6 }}
                />
              )}

              {/* Main card */}
              <div
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${currentProduct.gradient} border border-white/15 cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl`}
                style={{
                  transform: `translateX(${cardTranslateX}px) rotate(${cardRotation}deg)`,
                  transition: dragging ? "none" : "transform 0.3s ease",
                  zIndex: 1,
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* LIKE badge */}
                <div
                  className="absolute top-6 left-6 bg-emerald-500 text-white text-lg font-black px-4 py-1.5 rounded-xl border-2 border-emerald-300 rotate-[-15deg] z-10"
                  style={{ opacity: likeOpacity }}
                >
                  BEĞENDİM ✓
                </div>

                {/* PASS badge */}
                <div
                  className="absolute top-6 right-6 bg-red-500 text-white text-lg font-black px-4 py-1.5 rounded-xl border-2 border-red-300 rotate-[15deg] z-10"
                  style={{ opacity: passOpacity }}
                >
                  GEÇ ✗
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex flex-col p-7">
                  {/* Category tag */}
                  <div className="self-start">
                    <span className="text-[11px] font-medium text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                      {CATEGORY_LABELS[currentProduct.category]}
                    </span>
                  </div>

                  {/* Emoji */}
                  <div className="flex-1 flex items-center justify-center">
                    <span
                      className="select-none"
                      style={{ fontSize: 120, lineHeight: 1, filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.4))" }}
                    >
                      {currentProduct.emoji}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white leading-tight">{currentProduct.name}</h3>
                    <p className="text-sm text-white/65 leading-relaxed">{currentProduct.description}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-bold text-white">{currentProduct.price}</span>
                      <span className="text-xs text-white/40 bg-white/8 px-2.5 py-1 rounded-full">
                        {currentProduct.shop}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Swipe hint */}
            <p className="text-xs text-white/25 text-center">Sürükle veya aşağıdaki butonları kullan</p>

            {/* Buttons */}
            <div className="flex items-center gap-5 w-full justify-center">
              <button
                onClick={() => swipe("left")}
                className="flex-1 max-w-[160px] flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/50 text-red-400 font-semibold py-3.5 rounded-2xl transition-all"
              >
                <span className="text-lg">✗</span>
                <span className="text-sm">Geç</span>
              </button>
              <button
                onClick={() => swipe("right")}
                className="flex-1 max-w-[160px] flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500/50 text-emerald-400 font-semibold py-3.5 rounded-2xl transition-all"
              >
                <span className="text-lg">♥</span>
                <span className="text-sm">Beğen</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ── */}
        {step === "results" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Summary */}
            <div className="text-center">
              <div className="text-4xl mb-3">
                {liked.length > 0 ? "🎉" : "😕"}
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                {liked.length > 0
                  ? `${liked.length} harika hediye seçtin!`
                  : "Hiç beğenmedin..."}
              </h2>
              <p className="text-sm text-white/50">
                {liked.length > 0
                  ? `Beril için ${occasionLabel} hediyelerini bulduk. Hepsini gör, en iyisini seç!`
                  : "Belki başka bir özel gün için tekrar deneyelim?"}
              </p>
            </div>

            {liked.length === 0 && (
              <button
                onClick={() => setStep("occasion")}
                className="self-center bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Tekrar Dene
              </button>
            )}

            {/* Liked products grouped by category */}
            {Object.entries(likedByCategory).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
                  {CATEGORY_LABELS[cat as Category]}
                </h3>
                <div className="space-y-3">
                  {items.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-4 bg-gradient-to-r ${product.gradient} bg-opacity-20 border border-white/10 rounded-2xl p-4`}
                    >
                      <div className="shrink-0 w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center text-3xl">
                        {product.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm leading-tight truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-white/50 mt-0.5">{product.price}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{product.shop}</p>
                      </div>
                      <a
                        href={product.buyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 bg-white text-black hover:bg-white/90 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap"
                      >
                        Hemen Al →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {liked.length > 0 && (
              <div className="mt-2 p-4 rounded-2xl bg-white/4 border border-white/8 text-center">
                <p className="text-xs text-white/40 leading-relaxed">
                  💡 Emin olamadın mı? "Hemen Al" linkine tıkla, incele, sonra karar ver.
                  <br />Beril seyahati, müziği ve kaliteyi sever — bu listede hepsi var!
                </p>
              </div>
            )}

            <button
              onClick={() => setStep("occasion")}
              className="self-center text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-4 py-2 rounded-xl transition-all"
            >
              Baştan Başla
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-3 px-4">
        <p className="text-center text-[10px] text-white/15">
          Beril'e özel · <a href="https://orhankarakopru.com.tr" className="hover:text-white/30 transition-colors">orhankarakopru.com.tr</a>
        </p>
      </footer>

    </div>
  );
}
