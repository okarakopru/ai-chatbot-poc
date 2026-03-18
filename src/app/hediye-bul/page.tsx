"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "welcome"
  | "recipient"
  | "personality"
  | "occasion"
  | "budget"
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
  "Bütçeye uygun ürünler taranıyor",
  "Kişiselleştirilmiş hediyeler hazırlanıyor",
  "Son dokunuşlar yapılıyor ✨",
];

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
      {!imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImageUrl(product.imageKeywords, product.id)}
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
        className="absolute top-6 left-6 bg-green-500 text-white font-black text-2xl px-5 py-2 rounded-2xl rotate-[-15deg] border-4 border-white shadow-lg"
        style={{ opacity: likeOpacity }}
      >
        BEĞEN 💚
      </div>
      {/* Pass badge */}
      <div
        className="absolute top-6 right-6 bg-red-500 text-white font-black text-2xl px-5 py-2 rounded-2xl rotate-[15deg] border-4 border-white shadow-lg"
        style={{ opacity: passOpacity }}
      >
        GEÇ ❌
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-white font-bold text-xl leading-tight">{product.name}</h2>
          <span className="text-3xl flex-shrink-0">{product.emoji}</span>
        </div>
        <p className="text-white/75 text-sm leading-snug mb-3">{product.description}</p>
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
  const [budget, setBudget] = useState<Budget | "">("");
  const [pastGifts, setPastGifts] = useState("");

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

  const fetchRecommendations = useCallback(async () => {
    setStep("loading");
    setLoadingText(LOADING_MESSAGES[0]);
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
          budget,
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
  }, [giverName, recipientName, relationship, duration, recipientAge, personalityAnswers, occasion, budget, pastGifts]);

  // ─── Swipe handlers ─────────────────────────────────────────────────────────

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      if (dir === "right") {
        setLiked((prev) => [...prev, products[currentIndex]]);
      }
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
      if (currentIndex + 1 >= products.length) {
        setStep("results");
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, products]
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
    const lines = liked
      .map((p, i) => `${i + 1}. *${p.name}* — ${p.price}\n🔗 ${p.buyUrl}`)
      .join("\n\n");
    const text = `🎁 *${recipientName} için hediye fikirleri*\n\n${lines}\n\n✨ _hediye.bul ile hazırlandı_`;
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
    setBudget("");
    setPastGifts("");
    setProducts([]);
    setLiked([]);
    setApiError(null);
  };

  // ─── Progress helper ─────────────────────────────────────────────────────────

  const totalSteps = 7; // welcome(1) recipient(2) personality(3) occasion(4) budget(5) past(6) → AI
  const stepNumbers: Record<Step, number> = {
    welcome: 1,
    recipient: 2,
    personality: 3,
    occasion: 4,
    budget: 5,
    past: 6,
    loading: 7,
    swipe: 7,
    results: 7,
  };
  const progress = Math.round(((stepNumbers[step] - 1) / (totalSteps - 1)) * 100);

  // ─── Layout wrapper ──────────────────────────────────────────────────────────

  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <span className="text-white/40 text-xs font-medium tracking-widest uppercase">
            Hediye Bulucu
          </span>
        </div>
        {step !== "welcome" && step !== "swipe" && step !== "results" && step !== "loading" && (
          <button onClick={resetAll} className="text-white/30 hover:text-white/60 text-xs transition-colors">
            Başa dön
          </button>
        )}
      </div>
      {/* Progress bar */}
      {step !== "welcome" && step !== "swipe" && step !== "results" && (
        <div className="px-5 mb-1">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {children}
    </main>
  );

  // ══════════════════════════════════════════════════════════════════
  // STEP: WELCOME
  // ══════════════════════════════════════════════════════════════════

  if (step === "welcome") {
    return (
      <PageShell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="text-center mb-10">
            <div className="text-6xl mb-5">🎁</div>
            <h1 className="text-4xl font-black text-white mb-3 leading-tight">
              Mükemmel<br />Hediyeyi Bul
            </h1>
            <p className="text-white/50 text-base max-w-xs mx-auto leading-relaxed">
              Kişilik profili çıkarıp AI ile tam uyumlu hediyeler öneriyoruz. 2 dakika, 20 öneri.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="text-white/60 text-sm mb-2 block">Adın nedir?</label>
              <input
                type="text"
                value={giverName}
                onChange={(e) => setGiverName(e.target.value)}
                placeholder="Adını yaz..."
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-violet-400 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && giverName.trim()) setStep("recipient");
                }}
                autoFocus
              />
            </div>
            <button
              onClick={() => setStep("recipient")}
              disabled={!giverName.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              Başla →
            </button>
          </div>

          <div className="mt-10 flex gap-6 text-center">
            {[["🎯", "Kişiselleştirilmiş"], ["🤖", "AI destekli"], ["⚡", "2 dakika"]].map(([emoji, label]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{emoji}</span>
                <span className="text-white/40 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: RECIPIENT
  // ══════════════════════════════════════════════════════════════════

  if (step === "recipient") {
    const canContinue = recipientName.trim() && relationship && duration;
    return (
      <PageShell>
        <div className="flex-1 flex flex-col px-5 pb-8 overflow-y-auto">
          <div className="pt-4 pb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Kime hediye alıyorsun?</h2>
            <p className="text-white/40 text-sm">Kişiyi ne kadar iyi tanırsak, o kadar iyi öneri üretiriz.</p>
          </div>

          {/* Name */}
          <div className="mb-5">
            <label className="text-white/60 text-sm mb-2 block">İsmi</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Hediye alacağın kişinin adı..."
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-400 transition-colors"
              autoFocus
            />
          </div>

          {/* Relationship */}
          <div className="mb-5">
            <label className="text-white/60 text-sm mb-3 block">İlişki türü</label>
            <div className="grid grid-cols-4 gap-2">
              {RELATIONSHIPS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRelationship(r.id)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-95 ${
                    relationship === r.id
                      ? "bg-violet-600 border-violet-500 text-white shadow-lg"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-xs">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-5">
            <label className="text-white/60 text-sm mb-3 block">Ne zamandır tanışıyorsunuz?</label>
            <div className="space-y-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-[0.98] ${
                    duration === d.id
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age (optional) */}
          <div className="mb-6">
            <label className="text-white/60 text-sm mb-2 block">Kaç yaşında? <span className="text-white/30">(opsiyonel)</span></label>
            <input
              type="number"
              value={recipientAge}
              onChange={(e) => setRecipientAge(e.target.value)}
              placeholder="ör. 28"
              min="1"
              max="100"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-400 transition-colors"
            />
          </div>

          <button
            onClick={() => { setPersonalityStep(0); setStep("personality"); }}
            disabled={!canContinue}
            className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            Devam →
          </button>
        </div>
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
      <PageShell>
        <div className="flex-1 flex flex-col px-5 pb-8">
          {/* Progress dots */}
          <div className="flex gap-2 pt-4 pb-6">
            {PERSONALITY_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < personalityStep ? "bg-violet-500" : i === personalityStep ? "bg-violet-400" : "bg-white/15"
                }`}
              />
            ))}
          </div>

          <div className="mb-2">
            <span className="text-white/40 text-xs font-medium">{recipientName} için soru {personalityStep + 1}/{PERSONALITY_QUESTIONS.length}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-6">{q.question}</h2>

          <div className="flex flex-col gap-4 flex-1">
            {q.choices.map((choice) => (
              <button
                key={choice.value}
                onClick={() => handleAnswer(choice.value)}
                className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 transition-all active:scale-[0.97] ${
                  answered === choice.value
                    ? "bg-violet-600/40 border-violet-500 shadow-lg shadow-violet-900/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25"
                }`}
              >
                <span className="text-5xl">{choice.emoji}</span>
                <div className="text-center">
                  <div className="text-white font-bold text-lg leading-tight">{choice.label}</div>
                  <div className="text-white/50 text-sm mt-1">{choice.sublabel}</div>
                </div>
              </button>
            ))}
          </div>

          {personalityStep > 0 && (
            <button
              onClick={() => setPersonalityStep((s) => s - 1)}
              className="mt-4 text-white/30 hover:text-white/60 text-sm transition-colors text-center"
            >
              ← Önceki soru
            </button>
          )}
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: OCCASION
  // ══════════════════════════════════════════════════════════════════

  if (step === "occasion") {
    return (
      <PageShell>
        <div className="flex-1 flex flex-col px-5 pb-8">
          <div className="pt-4 pb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Ne için hediye?</h2>
            <p className="text-white/40 text-sm">Özel gün türüne göre önerileri şekillendiriyoruz.</p>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {OCCASIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => { setOccasion(o.id); setStep("budget"); }}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  occasion === o.id
                    ? "bg-violet-600/40 border-violet-500"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25"
                }`}
              >
                <span className="text-3xl">{o.emoji}</span>
                <div className="text-left">
                  <div className="text-white font-bold">{o.label}</div>
                  <div className="text-white/45 text-sm">{o.desc}</div>
                </div>
                {occasion === o.id && <span className="ml-auto text-violet-400">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: BUDGET
  // ══════════════════════════════════════════════════════════════════

  if (step === "budget") {
    return (
      <PageShell>
        <div className="flex-1 flex flex-col px-5 pb-8">
          <div className="pt-4 pb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Bütçen ne kadar?</h2>
            <p className="text-white/40 text-sm">Öneriler bu aralıkta kalacak, söz.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1 content-start">
            {BUDGETS.map((b) => (
              <button
                key={b.id}
                onClick={() => { setBudget(b.id); setStep("past"); }}
                className={`flex flex-col items-center justify-center gap-2 py-8 rounded-3xl border-2 transition-all active:scale-[0.97] ${
                  budget === b.id
                    ? "bg-violet-600/40 border-violet-500 shadow-lg"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/25"
                }`}
              >
                <span className="text-white font-black text-xl">{b.label}</span>
                <span className="text-white/45 text-sm">{b.sublabel}</span>
              </button>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: PAST GIFTS (optional)
  // ══════════════════════════════════════════════════════════════════

  if (step === "past") {
    return (
      <PageShell>
        <div className="flex-1 flex flex-col px-5 pb-8">
          <div className="pt-4 pb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Daha önce ne hediye ettin?</h2>
            <p className="text-white/40 text-sm">Aynı şeyleri önermemek için. Opsiyonel, atlayabilirsin.</p>
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
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-400 transition-colors resize-none mb-4"
          />

          <div className="flex gap-3 mt-auto">
            <button
              onClick={fetchRecommendations}
              className="flex-1 bg-white/10 hover:bg-white/15 text-white/70 font-bold py-4 rounded-2xl transition-all active:scale-95"
            >
              Atla →
            </button>
            <button
              onClick={fetchRecommendations}
              className="flex-[2] bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              Hediyeleri Bul ✨
            </button>
          </div>

          <p className="text-white/25 text-xs text-center mt-4">
            AI ile 20 kişiselleştirilmiş öneri üretilecek
          </p>
        </div>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: LOADING
  // ══════════════════════════════════════════════════════════════════

  if (step === "loading") {
    const dots = ".".repeat(loadingDots);
    return (
      <PageShell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 gap-8">
          {/* Animated rings */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-ping" />
            <div className="absolute inset-3 rounded-full border-4 border-violet-500/30 animate-ping" style={{ animationDelay: "0.3s" }} />
            <div className="absolute inset-6 rounded-full border-4 border-pink-500/40 animate-ping" style={{ animationDelay: "0.6s" }} />
            <span className="text-5xl z-10 animate-pulse">🤖</span>
          </div>

          <div className="text-center">
            <h2 className="text-white font-bold text-xl mb-2">
              {recipientName} için öneriler hazırlanıyor
            </h2>
            <p className="text-violet-300 text-base min-h-[1.5em]">
              {loadingText}{dots}
            </p>
          </div>

          {/* Profile summary */}
          <div className="w-full max-w-sm bg-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Kişi</span>
              <span className="text-white/80 font-medium">{recipientName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Özel gün</span>
              <span className="text-white/80 font-medium">{OCCASIONS.find((o) => o.id === occasion)?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Bütçe</span>
              <span className="text-white/80 font-medium">{BUDGETS.find((b) => b.id === budget)?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Kişilik soruları</span>
              <span className="text-white/80 font-medium">{Object.keys(personalityAnswers).length}/5 ✓</span>
            </div>
          </div>
        </div>
      </PageShell>
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
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <span className="text-white font-semibold">{recipientName} için hediyeler</span>
          </div>
          <span className="text-white/40 text-sm">{currentIndex + 1} / {products.length}</span>
        </div>

        {/* Progress bar */}
        <div className="px-5 mb-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / products.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card stack */}
        <div className="flex-1 relative mx-4 mb-4" style={{ minHeight: 460 }}>
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
        <div className="flex justify-center gap-8 px-8 pb-8 pt-2">
          <button
            onClick={() => handleSwipe("left")}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-red-500/30 border-2 border-white/20 hover:border-red-400 text-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg"
          >
            ❌
          </button>
          <button
            onClick={() => setStep("results")}
            className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs hover:bg-white/10 transition-all"
          >
            Listeye bak ({liked.length})
          </button>
          <button
            onClick={() => handleSwipe("right")}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-green-500/30 border-2 border-white/20 hover:border-green-400 text-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg"
          >
            💚
          </button>
        </div>

        {/* Hint */}
        <p className="text-center text-white/20 text-xs pb-5">
          Sola kaydır = geç · Sağa kaydır = beğen
        </p>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP: RESULTS
  // ══════════════════════════════════════════════════════════════════

  if (step === "results") {
    const hasLiked = liked.length > 0;

    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎉</span>
            <h1 className="text-2xl font-bold text-white">
              {hasLiked ? `${liked.length} hediye seçtin!` : "Hiç beğenmedin..."}
            </h1>
          </div>
          <p className="text-white/45 text-sm pl-12">
            {hasLiked
              ? `${recipientName} bunları çok sevecek`
              : "Tekrar deneyebilir veya swipe'a geri dönebilirsin"}
          </p>
        </div>

        {hasLiked ? (
          <>
            {/* Liked products list */}
            <div className="flex-1 px-5 space-y-3 overflow-y-auto pb-4">
              {liked.map((p, i) => (
                <a
                  key={p.id}
                  href={p.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl transition-all group"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                    <img
                      src={getImageUrl(p.imageKeywords, p.id)}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white font-semibold text-sm leading-tight truncate">{p.name}</p>
                      <span className="text-lg flex-shrink-0">{p.emoji}</span>
                    </div>
                    <p className="text-violet-300 font-medium text-sm">{p.price}</p>
                    <p className="text-white/40 text-xs">{p.shop} →</p>
                  </div>
                  <span className="text-white/30 group-hover:text-white/60 transition-colors text-lg">›</span>
                </a>
              ))}
            </div>

            {/* Actions */}
            <div className="px-5 pb-8 pt-3 space-y-3">
              <button
                onClick={shareOnWhatsApp}
                className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
              >
                <span className="text-2xl">💬</span>
                WhatsApp&apos;a Gönder
              </button>
              <button
                onClick={() => { setCurrentIndex(0); setStep("swipe"); }}
                className="w-full bg-white/10 hover:bg-white/15 text-white/70 font-bold py-3.5 rounded-2xl transition-all active:scale-95"
              >
                ← Swipe&apos;a Dön
              </button>
              <button
                onClick={resetAll}
                className="w-full text-white/30 hover:text-white/50 font-medium py-2 transition-colors text-sm"
              >
                Baştan Başla
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 pb-10">
            <span className="text-7xl">🤔</span>
            <p className="text-white/50 text-center text-base">
              Hiç beğendin yok. Yeni bir liste üretebilir ya da swipe&apos;a dönüp tekrar bakabilirsin.
            </p>
            <button
              onClick={() => { setCurrentIndex(0); setStep("swipe"); }}
              className="w-full max-w-xs bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
            >
              Tekrar Bak
            </button>
            <button
              onClick={fetchRecommendations}
              className="w-full max-w-xs bg-white/10 text-white/70 font-bold py-4 rounded-2xl transition-all active:scale-95"
            >
              Yeni Liste Üret 🔄
            </button>
            <button onClick={resetAll} className="text-white/30 hover:text-white/50 text-sm transition-colors">
              Baştan Başla
            </button>
          </div>
        )}
      </main>
    );
  }

  return null;
}
