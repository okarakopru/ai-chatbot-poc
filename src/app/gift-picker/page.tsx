"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "welcome"
  | "recipient"
  | "personality"
  | "occasion"
  | "past"
  | "loading"
  | "swipe"
  | "results";

type Relationship = "sevgilim" | "esim" | "annem" | "babam" | "arkadasim" | "kardesim" | "diger";
type Duration = "new" | "medium" | "long" | "verylong";
type Occasion = "birthday" | "valentines" | "anniversary" | "newyear" | "surprise";
type Budget = "0-500" | "500-1500" | "1500-5000" | "5000+";

type PersonalityKey = "lifestyle" | "giftStyle" | "aesthetic" | "energy" | "valueType";
type PersonalityAnswers = Partial<Record<PersonalityKey, string>>;

type AIProduct = {
  id: number;
  name: string;
  description: string;
  price: string;
  emoji: string;
  category: string;
  imageKeywords: string;
  imageUrl?: string;
  buyUrl: string;
  shop: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const PERSONALITY_QUESTIONS: {
  id: PersonalityKey;
  question: string;
  choices: { value: string; emoji: string; label: string; sublabel: string }[];
}[] = [
  {
    id: "lifestyle",
    question: "Zamanını nasıl geçirir?",
    choices: [
      { value: "home", emoji: "🏠", label: "Evde vakit geçirmeyi sever", sublabel: "Film, kitap, dinlenme, huzur" },
      { value: "outdoor", emoji: "🌍", label: "Dışarıda keşfetmeyi sever", sublabel: "Seyahat, sosyal aktiviteler" },
    ],
  },
  {
    id: "giftStyle",
    question: "Hediyeye bakışı nasıl?",
    choices: [
      { value: "practical", emoji: "📦", label: "Pratik & işe yarayan", sublabel: "Her gün kullanılacak şeyler" },
      { value: "sentimental", emoji: "💝", label: "Anlamlı & duygusal", sublabel: "Düşünceyi gösteren özel şeyler" },
    ],
  },
  {
    id: "aesthetic",
    question: "Tarzı nasıl?",
    choices: [
      { value: "minimal", emoji: "🎯", label: "Sade & minimalist", sublabel: "Az ama öz, temiz çizgiler" },
      { value: "luxury", emoji: "✨", label: "Lüks & gösterişli", sublabel: "Kaliteli, dikkat çeken şeyler" },
    ],
  },
  {
    id: "energy",
    question: "Enerjisi nasıl?",
    choices: [
      { value: "calm", emoji: "🧘", label: "Sakin & huzurlu", sublabel: "Dingin, iç dünyasına yönelmiş biri" },
      { value: "active", emoji: "⚡", label: "Aktif & enerjik", sublabel: "Canlı, dinamik, sosyal biri" },
    ],
  },
  {
    id: "valueType",
    question: "Ne daha değerli?",
    choices: [
      { value: "experience", emoji: "🎭", label: "Deneyimler & anılar", sublabel: "Yaşananlar, hissedilenler" },
      { value: "item", emoji: "🎁", label: "Somut eşyalar & ürünler", sublabel: "Kullanılan, sahip olunan şeyler" },
    ],
  },
];

const OCCASIONS: { id: Occasion; label: string; emoji: string; desc: string }[] = [
  { id: "birthday", label: "Doğum Günü", emoji: "🎂", desc: "Yıllık özel gün" },
  { id: "valentines", label: "Sevgililer Günü", emoji: "💕", desc: "14 Şubat" },
  { id: "anniversary", label: "Yıldönümü", emoji: "💍", desc: "İlişki yıldönümü" },
  { id: "newyear", label: "Yılbaşı", emoji: "🎉", desc: "Yeni yıl hediyesi" },
  { id: "surprise", label: "Sürpriz", emoji: "🎁", desc: "Sebepsiz sürpriz" },
];

const BUDGETS: { id: Budget; label: string; sublabel: string }[] = [
  { id: "0-500", label: "0 – 500 ₺", sublabel: "Sembolik & şık" },
  { id: "500-1500", label: "500 – 1.500 ₺", sublabel: "Kaliteli & düşünceli" },
  { id: "1500-5000", label: "1.500 – 5.000 ₺", sublabel: "Premium & özel" },
  { id: "5000+", label: "5.000 ₺ +", sublabel: "Lüks & unutulmaz" },
];

const RELATIONSHIPS: { id: Relationship; label: string; emoji: string }[] = [
  { id: "sevgilim", label: "Sevgilim", emoji: "💕" },
  { id: "esim", label: "Eşim", emoji: "💍" },
  { id: "annem", label: "Annem", emoji: "🌸" },
  { id: "babam", label: "Babam", emoji: "🏅" },
  { id: "arkadasim", label: "Arkadaşım", emoji: "🤝" },
  { id: "kardesim", label: "Kardeşim", emoji: "🫂" },
  { id: "diger", label: "Diğer", emoji: "🎁" },
];

const DURATIONS: { id: Duration; label: string }[] = [
  { id: "new", label: "Yeni tanışıyoruz (< 6 ay)" },
  { id: "medium", label: "6 ay – 1 yıl" },
  { id: "long", label: "1 – 3 yıl" },
  { id: "verylong", label: "3+ yıl" },
];

const LOADING_MESSAGES = [
  "Profil analiz ediliyor",
  "Kişilik özellikleri değerlendiriliyor",
  "Geniş ürün kataloğu taranıyor",
  "Kişiselleştirilmiş hediyeler hazırlanıyor",
  "Son dokunuşlar yapılıyor ✨",
];

// ─── Price helpers (for results filter) ──────────────────────────────────────

function parsePriceMin(price: string): number {
  const cleaned = price.replace(/\./g, "");
  const match = cleaned.match(/₺(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function getPriceTier(price: string): Budget {
  const min = parsePriceMin(price);
  if (min < 500) return "0-500";
  if (min < 1500) return "500-1500";
  if (min < 5000) return "1500-5000";
  return "5000+";
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  güzellik: "from-pink-800 via-rose-700 to-pink-700",
  kozmetik: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
  teknoloji: "from-blue-800 via-blue-700 to-indigo-700",
  elektronik: "from-indigo-800 via-indigo-700 to-violet-700",
  seyahat: "from-amber-800 via-amber-700 to-orange-700",
  kitap: "from-amber-900 via-amber-800 to-orange-800",
  müzik: "from-violet-800 via-purple-700 to-violet-700",
  spor: "from-teal-800 via-teal-700 to-emerald-700",
  deneyim: "from-rose-800 via-red-700 to-rose-700",
  yemek: "from-green-800 via-emerald-700 to-green-700",
  moda: "from-fuchsia-700 via-fuchsia-600 to-pink-600",
  aksesuar: "from-amber-700 via-yellow-600 to-amber-700",
  ev: "from-emerald-800 via-green-700 to-teal-700",
  koku: "from-rose-900 via-rose-800 to-pink-800",
  lifestyle: "from-slate-700 via-slate-600 to-gray-600",
};

function getCategoryGradient(category: string): string {
  const lower = category.toLowerCase();
  for (const [key, gradient] of Object.entries(CATEGORY_GRADIENTS)) {
    if (lower.includes(key)) return gradient;
  }
  return "from-indigo-800 via-indigo-700 to-blue-700";
}

function getImageUrl(keywords: string, id: number): string {
  return `https://loremflickr.com/600/800/${encodeURIComponent(keywords)}?lock=${(id * 997 + 42) % 99991}`;
}

// ─── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  product,
  style,
  handlers,
  likeOpacity = 0,
  passOpacity = 0,
}: {
  product: AIProduct;
  style: React.CSSProperties;
  handlers?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  likeOpacity?: number;
  passOpacity?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const gradient = getCategoryGradient(product.category);

  return (
    <div
      className={`absolute inset-0 rounded-3xl overflow-hidden shadow-2xl border border-white/10 ${handlers ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={style}
      onMouseDown={handlers?.onMouseDown}
      onMouseMove={handlers?.onMouseMove}
      onMouseUp={handlers?.onMouseUp}
      onMouseLeave={handlers?.onMouseUp}
      onTouchStart={handlers?.onTouchStart}
      onTouchMove={handlers?.onTouchMove}
      onTouchEnd={handlers?.onTouchEnd}
    >
      {/* Background */}
      {!imgError && (product.imageUrl || getImageUrl(product.imageKeywords, product.id)) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl || getImageUrl(product.imageKeywords, product.id)}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Like badge */}
      <div
        className="absolute top-6 left-6 bg-green-500 text-white font-black text-xl px-4 py-1.5 rounded-xl rotate-[-15deg] border-2 border-white shadow-lg"
        style={{ opacity: likeOpacity }}
      >
        BEĞEN 💚
      </div>
      {/* Pass badge */}
      <div
        className="absolute top-6 right-6 bg-red-500 text-white font-black text-xl px-4 py-1.5 rounded-xl rotate-[15deg] border-2 border-white shadow-lg"
        style={{ opacity: passOpacity }}
      >
        GEÇ ❌
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-white font-bold text-lg leading-tight">{product.name}</h2>
          <span className="text-3xl flex-shrink-0">{product.emoji}</span>
        </div>
        <p className="text-white/70 text-sm leading-snug mb-3">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-base">{product.price}</span>
          <span className="text-white/60 text-xs bg-white/10 px-3 py-1 rounded-full">
            {product.shop}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PageShell (defined outside main component to avoid remount on re-render) ───

function PageShell({
  step,
  progress,
  resetAll,
  children,
}: {
  step: Step;
  progress: number;
  resetAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0d0d16] flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen flex flex-col">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-white/40 text-xs font-medium tracking-widest uppercase">
            Hediye Bulucu
          </span>
          {step !== "welcome" && step !== "swipe" && step !== "results" && step !== "loading" && (
            <button onClick={resetAll} className="text-white/30 hover:text-white/60 text-xs transition-colors">
              Başa dön
            </button>
          )}
        </div>
        {step !== "welcome" && step !== "swipe" && step !== "results" && (
          <div className="px-5 pb-2">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col px-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function HediyeBulPage() {
  // Step
  const [step, setStep] = useState<Step>("welcome");

  // Profile state
  const [giverName, setGiverName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState<Relationship | "">("");
  const [duration, setDuration] = useState<Duration | "">("");
  const [recipientAge, setRecipientAge] = useState("");
  const [personalityAnswers, setPersonalityAnswers] = useState<PersonalityAnswers>({});
  const [personalityStep, setPersonalityStep] = useState(0);
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [pastGifts, setPastGifts] = useState("");
  const [budgetFilter, setBudgetFilter] = useState<Budget | "all">("all");

  // Loading
  const [loadingText, setLoadingText] = useState(LOADING_MESSAGES[0]);
  const [loadingDots, setLoadingDots] = useState(0);

  // Products + swipe
  const [products, setProducts] = useState<AIProduct[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<AIProduct[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Swipe state
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);

  // ─── Loading animation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== "loading") return;
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1);
      setLoadingText(LOADING_MESSAGES[msgIdx]);
    }, 1600);
    const dotsInterval = setInterval(() => {
      setLoadingDots((d) => (d + 1) % 4);
    }, 400);
    return () => {
      clearInterval(msgInterval);
      clearInterval(dotsInterval);
    };
  }, [step]);

  // ─── AI fetch ───────────────────────────────────────────────────────────────

  const fetchRecommendations = useCallback(async (initialMessage?: string) => {
    setStep("loading");
    setLoadingText(initialMessage ?? LOADING_MESSAGES[0]);
    setApiError(null);
    try {
      const res = await fetch("/api/gift-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giverName,
          recipient: { name: recipientName, relationship, duration, age: recipientAge || undefined },
          personality: personalityAnswers,
          occasion,
          pastGifts: pastGifts.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.products) || data.products.length === 0)
        throw new Error("Ürün listesi boş geldi");

      setProducts(data.products);
      setCurrentIndex(0);
      setLiked([]);
      setStep("swipe");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      setApiError(msg);
      setStep("past");
    }
  }, [giverName, recipientName, relationship, duration, recipientAge, personalityAnswers, occasion, pastGifts]);

  // ─── Swipe handlers ─────────────────────────────────────────────────────────

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      const newLiked = dir === "right" ? [...liked, products[currentIndex]] : liked;
      if (dir === "right") {
        setLiked(newLiked);
      }
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
      if (currentIndex + 1 >= products.length) {
        if (newLiked.length === 0) {
          // No likes at all — fetch a fresh batch automatically
          fetchRecommendations("Farklı öneriler aranıyor ✨");
        } else {
          setStep("results");
        }
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, products, liked, fetchRecommendations]
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
    startY.current = e.clientY;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setDragX(e.clientX - startX.current);
      setDragY(e.clientY - startY.current);
    },
    [isDragging]
  );

  const onMouseUp = useCallback(() => {
    if (!isDragging) return;
    if (dragX > 80) handleSwipe("right");
    else if (dragX < -80) handleSwipe("left");
    else {
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
    }
  }, [isDragging, dragX, handleSwipe]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      setDragX(e.touches[0].clientX - startX.current);
      setDragY(e.touches[0].clientY - startY.current);
    },
    [isDragging]
  );

  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    if (dragX > 60) handleSwipe("right");
    else if (dragX < -60) handleSwipe("left");
    else {
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
    }
  }, [isDragging, dragX, handleSwipe]);

  // ─── WhatsApp share ──────────────────────────────────────────────────────────

  const shareOnWhatsApp = () => {
    const toShare = budgetFilter === "all"
      ? liked
      : liked.filter((p) => getPriceTier(p.price) === budgetFilter);
    const lines = toShare
      .map((p, i) => `${i + 1}. *${p.name}* — ${p.price}\n🔗 ${p.buyUrl}`)
      .join("\n\n");
    const text = `🎁 *${recipientName} için hediye fikirleri*\n\n${lines}\n\n✨ _gift-picker ile hazırlandı_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ─── Reset ───────────────────────────────────────────────────────────────────

  const resetAll = () => {
    setStep("welcome");
    setGiverName("");
    setRecipientName("");
    setRelationship("");
    setDuration("");
    setRecipientAge("");
    setPersonalityAnswers({});
    setPersonalityStep(0);
    setOccasion("");
    setPastGifts("");
    setBudgetFilter("all");
    setProducts([]);
    setLiked([]);
    setApiError(null);
  };

  // ─── Progress helper ─────────────────────────────────────────────────────────

  const totalSteps = 6; // welcome(1) recipient(2) personality(3) occasion(4) past(5) → AI(6)
  const stepNumbers: Record<Step, number> = {
    welcome: 1,
    recipient: 2,
    personality: 3,
    occasion: 4,
    past: 5,
    loading: 6,
    swipe: 6,
    results: 6,
  };
  const progress = Math.round(((stepNumbers[step] - 1) / (totalSteps - 1)) * 100);

  // ─── Layout wrapper ──────────────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════
  // STEP: WELCOME
  // ══════════════════════════════════════════════════════════════════

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-[#0d0d16] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10">
            <div className="text-center">
              <div className="text-5xl mb-2">🎁</div>
              <h1 className="text-3xl font-black text-white leading-tight text-center">
                Mükemmel<br />Hediyeyi Bul
              </h1>
              <p className="text-sm text-white/45 text-center max-w-[280px] mx-auto mt-2">
                Kişilik profili çıkarıp AI ile tam uyumlu hediyeler öneriyoruz. 2 dakika, 20 öneri.
              </p>
            </div>

            <div className="w-full space-y-3">
              <div>
                <label className="text-xs font-medium text-white/45 mb-2 block uppercase tracking-wide">Adın nedir?</label>
                <input
                  type="text"
                  value={giverName}
                  onChange={(e) => setGiverName(e.target.value)}
                  placeholder="Adını yaz..."
                  className="w-full bg-white/[0.07] border border-white/[0.10] text-white placeholder-white/25 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.09] transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && giverName.trim()) setStep("recipient");
                  }}
                  autoFocus
                />
              </div>
              <button
                onClick={() => setStep("recipient")}
                disabled={!giverName.trim()}
                className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold py-3.5 rounded-2xl text-base transition-all active:scale-[0.98] disabled:opacity-30"
              >
                Başla →
              </button>
            </div>

            <div className="flex gap-6 text-center">
              {[["🎯", "Kişiselleştirilmiş"], ["🤖", "AI destekli"], ["⚡", "2 dakika"]].map(([emoji, label]) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs text-white/35">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: RECIPIENT
  // ══════════════════════════════════════════════════════════════════

  if (step === "recipient") {
    const canContinue = recipientName.trim() && relationship && duration;
    return (
      <PageShell step={step} progress={progress} resetAll={resetAll}>
        <div className="pt-4">
          <h2 className="text-xl font-bold text-white">Kime hediye alıyorsun?</h2>
          <p className="text-sm text-white/40 mt-0.5 mb-5">Kişiyi ne kadar iyi tanırsak, o kadar iyi öneri üretiriz.</p>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="text-xs font-medium text-white/45 mb-2 block uppercase tracking-wide">İsmi</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Hediye alacağın kişinin adı..."
            className="w-full bg-white/[0.07] border border-white/[0.10] text-white placeholder-white/25 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.09] transition-all"
          />
        </div>

        {/* Relationship */}
        <div className="mb-5">
          <label className="text-xs font-medium text-white/45 mb-2 block uppercase tracking-wide">İlişki türü</label>
          <div className="grid grid-cols-4 gap-2">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRelationship(r.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-medium transition-all active:scale-95 ${
                  relationship === r.id
                    ? "bg-violet-600/20 border-violet-500/60 text-white"
                    : "bg-white/[0.05] border-white/[0.08] text-white/50"
                }`}
              >
                <span className="text-lg">{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mb-5">
          <label className="text-xs font-medium text-white/45 mb-2 block uppercase tracking-wide">Ne zamandır tanışıyorsunuz?</label>
          <div className="space-y-2">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDuration(d.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all active:scale-[0.98] ${
                  duration === d.id
                    ? "bg-violet-600/20 border-violet-500/60 text-white"
                    : "bg-white/[0.04] border-white/[0.07] text-white/50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Age (optional) */}
        <div className="mb-6">
          <label className="text-xs font-medium text-white/45 mb-2 block uppercase tracking-wide">
            Kaç yaşında? <span className="text-white/25 normal-case">(opsiyonel)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={recipientAge}
            onChange={(e) => setRecipientAge(e.target.value.replace(/\D/g, ""))}
            placeholder="ör. 28"
            className="w-full bg-white/[0.07] border border-white/[0.10] text-white placeholder-white/25 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.09] transition-all"
          />
        </div>

        <button
          onClick={() => { setPersonalityStep(0); setStep("personality"); }}
          disabled={!canContinue}
          className="mt-auto w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold py-3.5 rounded-2xl text-base transition-all active:scale-[0.98] disabled:opacity-30 mb-6"
        >
          Devam →
        </button>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: PERSONALITY (5 binary questions)
  // ══════════════════════════════════════════════════════════════════

  if (step === "personality") {
    const q = PERSONALITY_QUESTIONS[personalityStep];
    const answered = personalityAnswers[q.id];

    const handleAnswer = (value: string) => {
      const updated = { ...personalityAnswers, [q.id]: value };
      setPersonalityAnswers(updated);
      setTimeout(() => {
        if (personalityStep < PERSONALITY_QUESTIONS.length - 1) {
          setPersonalityStep((s) => s + 1);
        } else {
          setStep("occasion");
        }
      }, 200);
    };

    return (
      <PageShell step={step} progress={progress} resetAll={resetAll}>
        {/* Progress dots */}
        <div className="flex gap-1.5 py-4">
          {PERSONALITY_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === personalityStep
                  ? "bg-violet-500 w-6"
                  : i < personalityStep
                  ? "bg-violet-500/40 flex-1"
                  : "bg-white/15 flex-1"
              }`}
            />
          ))}
        </div>

        <div className="mb-1">
          <span className="text-xs text-white/35">{recipientName} için soru {personalityStep + 1}/{PERSONALITY_QUESTIONS.length}</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-5 leading-snug">{q.question}</h2>

        <div className="flex flex-col gap-3 flex-1">
          {q.choices.map((choice) => (
            <button
              key={choice.value}
              onClick={() => handleAnswer(choice.value)}
              className={`flex-1 flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all active:scale-[0.97] cursor-pointer ${
                answered === choice.value
                  ? "bg-violet-600/15 border-violet-500/50"
                  : "bg-white/[0.04] border-white/[0.08] hover:border-white/[0.18]"
              }`}
            >
              <span className="text-4xl">{choice.emoji}</span>
              <div className="text-center">
                <div className="text-white font-semibold text-base leading-snug">{choice.label}</div>
                <div className="text-white/40 text-xs text-center mt-1">{choice.sublabel}</div>
              </div>
            </button>
          ))}
        </div>

        {personalityStep > 0 && (
          <button
            onClick={() => setPersonalityStep((s) => s - 1)}
            className="text-white/25 text-xs mt-3 mx-auto block mb-4"
          >
            ← Önceki soru
          </button>
        )}
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: OCCASION
  // ══════════════════════════════════════════════════════════════════

  if (step === "occasion") {
    return (
      <PageShell step={step} progress={progress} resetAll={resetAll}>
        <div className="pt-4">
          <h2 className="text-xl font-bold text-white">Ne için hediye?</h2>
          <p className="text-sm text-white/40 mt-0.5 mb-5">Özel gün türüne göre önerileri şekillendiriyoruz.</p>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 pb-6">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => { setOccasion(o.id); setStep("past"); }}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.99] ${
                occasion === o.id
                  ? "bg-violet-600/20 border-violet-500/60"
                  : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07]"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{o.emoji}</span>
              <div className="text-left">
                <div className="text-white font-medium text-sm">{o.label}</div>
                <div className="text-white/40 text-xs">{o.desc}</div>
              </div>
              {occasion === o.id && <span className="text-violet-400 ml-auto text-sm">✓</span>}
            </button>
          ))}
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: PAST GIFTS (optional)
  // ══════════════════════════════════════════════════════════════════

  if (step === "past") {
    return (
      <PageShell step={step} progress={progress} resetAll={resetAll}>
        <div className="pt-4">
          <h2 className="text-xl font-bold text-white">Daha önce ne hediye ettin?</h2>
          <p className="text-sm text-white/40 mt-0.5 mb-5">Aynı şeyleri önermemek için. Opsiyonel, atlayabilirsin.</p>
        </div>

        {apiError && (
          <div className="mb-4 p-4 bg-red-900/40 border border-red-500/40 rounded-2xl">
            <p className="text-red-300 text-sm">⚠️ {apiError}</p>
          </div>
        )}

        <textarea
          value={pastGifts}
          onChange={(e) => setPastGifts(e.target.value)}
          placeholder={`ör. Geçen yıl parfüm almıştım, doğum gününde kitap seti verdim...`}
          rows={4}
          className="w-full bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/25 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-violet-500/60 resize-none transition-all mb-4"
        />

        <div className="flex gap-3 mt-auto mb-2">
          <button
            onClick={() => fetchRecommendations()}
            className="bg-white/[0.08] text-white/50 font-medium py-3.5 rounded-2xl flex-1 text-sm transition-all active:scale-[0.98]"
          >
            Atla →
          </button>
          <button
            onClick={() => fetchRecommendations()}
            className="bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold py-3.5 rounded-2xl flex-[2] text-sm transition-all active:scale-[0.98]"
          >
            Hediyeleri Bul ✨
          </button>
        </div>

        <p className="text-white/20 text-xs text-center mt-3 mb-6">
          AI ile 20 kişiselleştirilmiş öneri üretilecek
        </p>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: LOADING
  // ══════════════════════════════════════════════════════════════════

  if (step === "loading") {
    const dots = ".".repeat(loadingDots);
    return (
      <div className="min-h-screen bg-[#0d0d16] flex justify-center">
        <div className="w-full max-w-[420px] min-h-screen flex flex-col items-center justify-center px-6 pb-10 gap-6">
          {/* Animated rings */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-ping" />
            <div className="absolute inset-3 rounded-full border-4 border-violet-500/30 animate-ping" style={{ animationDelay: "0.3s" }} />
            <div className="absolute inset-6 rounded-full border-4 border-pink-500/40 animate-ping" style={{ animationDelay: "0.6s" }} />
            <span className="text-4xl z-10 animate-pulse">🤖</span>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold text-white mb-2">
              {recipientName} için öneriler hazırlanıyor
            </h2>
            <p className="text-violet-300/80 text-sm min-h-[1.5em]">
              {loadingText}{dots}
            </p>
          </div>

          {/* Profile summary */}
          <div className="bg-white/[0.05] rounded-2xl p-4 space-y-2.5 w-full text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Kişi</span>
              <span className="text-white/80 font-medium">{recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Özel gün</span>
              <span className="text-white/80 font-medium">{OCCASIONS.find((o) => o.id === occasion)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Kişilik soruları</span>
              <span className="text-white/80 font-medium">{Object.keys(personalityAnswers).length}/5 ✓</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: SWIPE
  // ══════════════════════════════════════════════════════════════════

  if (step === "swipe") {
    const currentProduct = products[currentIndex];
    const nextProduct = products[currentIndex + 1];
    const rotate = dragX * 0.08;
    const likeOpacity = Math.max(0, dragX / 100);
    const passOpacity = Math.max(0, -dragX / 100);

    return (
      <div className="min-h-screen bg-[#0d0d16] flex justify-center">
        <div className="max-w-[420px] w-full min-h-screen flex flex-col select-none">
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-white font-semibold text-sm">{recipientName} için hediyeler</span>
            </div>
            <span className="text-white/40 text-xs">{currentIndex + 1} / {products.length}</span>
          </div>

          {/* Progress bar */}
          <div className="mx-5 mb-3 h-0.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / products.length) * 100}%` }}
            />
          </div>

          {/* Card stack */}
          <div className="flex-1 mx-4 relative" style={{ minHeight: 0 }}>
            {/* Next card (behind) */}
            {nextProduct && (
              <ProductCard
                product={nextProduct}
                style={{ transform: "scale(0.94) translateY(8px)", zIndex: 1 }}
              />
            )}
            {/* Empty state behind */}
            {!nextProduct && (
              <div className="absolute inset-0 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-white/20 text-sm">Son kart</span>
              </div>
            )}

            {/* Current card */}
            {currentProduct && (
              <ProductCard
                product={currentProduct}
                style={{
                  transform: `translateX(${dragX}px) translateY(${dragY * 0.3}px) rotate(${rotate}deg)`,
                  zIndex: 10,
                  transition: isDragging ? "none" : "transform 0.3s ease",
                }}
                handlers={{ onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd }}
                likeOpacity={likeOpacity}
                passOpacity={passOpacity}
              />
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-center items-center gap-6 px-5 py-4">
            <button
              onClick={() => handleSwipe("left")}
              className="w-14 h-14 rounded-full bg-white/[0.08] border border-white/[0.12] text-xl flex items-center justify-center transition-all active:scale-90"
            >
              ❌
            </button>
            <button
              onClick={() => setStep("results")}
              className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/35 text-xs transition-all"
            >
              Listeye bak ({liked.length})
            </button>
            <button
              onClick={() => handleSwipe("right")}
              className="w-14 h-14 rounded-full bg-white/[0.08] border border-white/[0.12] text-xl flex items-center justify-center transition-all active:scale-90"
            >
              💚
            </button>
          </div>

          {/* Hint */}
          <p className="text-center text-white/20 text-[11px] pb-4">
            Sola kaydır = geç · Sağa kaydır = beğen
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: RESULTS
  // ══════════════════════════════════════════════════════════════════

  if (step === "results") {
    const hasLiked = liked.length > 0;

    const filteredLiked = budgetFilter === "all"
      ? liked
      : liked.filter((p) => getPriceTier(p.price) === budgetFilter);

    const budgetCounts = BUDGETS.reduce<Record<string, number>>((acc, b) => {
      acc[b.id] = liked.filter((p) => getPriceTier(p.price) === b.id).length;
      return acc;
    }, {});

    return (
      <div className="min-h-screen bg-[#0d0d16] flex justify-center">
        <div className="max-w-[420px] w-full min-h-screen flex flex-col">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🎉</span>
              <h1 className="text-xl font-bold text-white">
                {hasLiked ? `${liked.length} hediye seçtin!` : "Hiç beğenmedin..."}
              </h1>
            </div>
            <p className="text-sm text-white/40 mt-0.5 pl-12">
              {hasLiked
                ? `${recipientName} bunları çok sevecek`
                : "Tekrar deneyebilir veya swipe'a geri dönebilirsin"}
            </p>
          </div>

          {hasLiked ? (
            <>
              {/* Budget filter chips */}
              <div className="flex gap-2 overflow-x-auto px-5 pb-3 scrollbar-hide">
                <button
                  onClick={() => setBudgetFilter("all")}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    budgetFilter === "all"
                      ? "bg-violet-600 text-white"
                      : "bg-white/[0.07] text-white/45"
                  }`}
                >
                  Tümü ({liked.length})
                </button>
                {BUDGETS.map((b) => budgetCounts[b.id] > 0 && (
                  <button
                    key={b.id}
                    onClick={() => setBudgetFilter(b.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      budgetFilter === b.id
                        ? "bg-violet-600 text-white"
                        : "bg-white/[0.07] text-white/45"
                    }`}
                  >
                    {b.label} ({budgetCounts[b.id]})
                  </button>
                ))}
              </div>

              {/* Liked products list */}
              <div className="flex-1 px-5 space-y-2.5 overflow-y-auto pb-4">
                {filteredLiked.length === 0 ? (
                  <div className="text-center py-10 text-white/30 text-sm">
                    Bu bütçe aralığında beğenilen hediye yok
                  </div>
                ) : filteredLiked.map((p) => (
                  <a
                    key={p.id}
                    href={p.buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3.5 p-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl hover:bg-white/[0.07] transition-all group"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                      <img
                        src={p.imageUrl || getImageUrl(p.imageKeywords, p.id)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight truncate">{p.name}</p>
                      <p className="text-violet-400 font-medium text-xs mt-0.5">{p.price}</p>
                      <p className="text-white/30 text-xs">{p.shop}</p>
                    </div>
                    <span className="text-white/20 group-hover:text-white/50 ml-auto transition-colors">›</span>
                  </a>
                ))}
              </div>

              {/* Actions */}
              <div className="px-5 pb-6 pt-2 space-y-2.5">
                <button
                  onClick={shareOnWhatsApp}
                  className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]"
                >
                  <span className="text-lg">💬</span>
                  WhatsApp&apos;a Gönder
                </button>
                <button
                  onClick={() => { setCurrentIndex(0); setStep("swipe"); }}
                  className="w-full bg-white/[0.08] text-white/60 font-medium py-3 rounded-2xl text-sm transition-all active:scale-[0.98]"
                >
                  ← Swipe&apos;a Dön
                </button>
                <button
                  onClick={resetAll}
                  className="w-full text-white/25 text-xs py-2"
                >
                  Baştan Başla
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 pb-10">
              <span className="text-7xl">🤔</span>
              <p className="text-white/50 text-center text-sm">
                Hiç beğendin yok. Yeni bir liste üretebilir ya da swipe&apos;a dönüp tekrar bakabilirsin.
              </p>
              <button
                onClick={() => { setCurrentIndex(0); setStep("swipe"); }}
                className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]"
              >
                Tekrar Bak
              </button>
              <button
                onClick={fetchRecommendations}
                className="w-full bg-white/[0.08] text-white/60 font-medium py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98]"
              >
                Yeni Liste Üret 🔄
              </button>
              <button onClick={resetAll} className="text-white/25 text-xs py-2">
                Baştan Başla
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
