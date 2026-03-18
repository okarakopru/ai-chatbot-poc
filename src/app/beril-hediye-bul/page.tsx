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
  // ── TRAVEL (20) ──
  {
    id: 1,
    name: "Deri Pasaport Cüzdanı",
    description: "Seyahatin vazgeçilmezi — şık ve kaliteli deri pasaport kılıfı. Her yolculukta yanında.",
    price: "₺299 – ₺599",
    emoji: "🛂",
    gradient: "from-amber-800 via-amber-700 to-orange-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=deri+pasaport+cuzdani&sst=MOST_RATED",
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
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+ani+gunlugu&sst=MOST_RATED",
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
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+boyun+yastigi+memory+foam&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 6,
    name: "Packing Cube Seti (6'lı)",
    description: "Bavulda kaos bitti. Kıyafetleri kategoriye göre ayıran kompresyon cube seti.",
    price: "₺349 – ₺699",
    emoji: "📦",
    gradient: "from-teal-800 via-teal-700 to-cyan-700",
    category: "travel",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=packing+cube+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 7,
    name: "RFID Engelleme Cüzdan",
    description: "Kart bilgileri güvende, tasarım şık. Seyahatin akıllı güvenlik aksesuarı.",
    price: "₺249 – ₺599",
    emoji: "🔐",
    gradient: "from-zinc-700 via-zinc-600 to-neutral-600",
    category: "travel",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=rfid+engelleme+cuzdani&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 8,
    name: "Universal Seyahat Adaptörü",
    description: "Dünyanın her prizinde çalışır. 4 USB çıkışlı akıllı seyahat adaptörü.",
    price: "₺299 – ₺649",
    emoji: "🔌",
    gradient: "from-orange-800 via-orange-700 to-amber-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=universal+seyahat+adaptoru",
    shop: "Hepsiburada",
  },
  {
    id: 9,
    name: "Dünya Haritası Scratch Map",
    description: "Gittiği yerleri kazıyarak işaret etsin. Duvarını süsleyecek anlamlı harita.",
    price: "₺299 – ₺549",
    emoji: "🗺️",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=scratch+map+dunya+haritasi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 10,
    name: "Microfiber Seyahat Havlusu",
    description: "Çanta boyutuna katlanıyor, süper hızlı kuruyor. Beach-to-hotel mükemmel seçim.",
    price: "₺199 – ₺449",
    emoji: "🏖️",
    gradient: "from-cyan-800 via-sky-700 to-blue-700",
    category: "travel",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=microfiber+seyahat+havlusu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 11,
    name: "Seyahat Uyku Seti",
    description: "Göz bandı + kulak tıkacı + boyun yastığı üçlüsü. Uçakta derin uyku garantisi.",
    price: "₺299 – ₺599",
    emoji: "😴",
    gradient: "from-indigo-800 via-indigo-700 to-violet-700",
    category: "travel",
    occasions: ["birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+uyku+seti+goz+bandi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 12,
    name: "Kişiselleştirilmiş Valiz Etiketi",
    description: "Adı ve renk tercihi yazılan şık deri bagaj etiketi. Valizi asla karışmaz.",
    price: "₺149 – ₺349",
    emoji: "🏷️",
    gradient: "from-rose-800 via-red-700 to-rose-700",
    category: "travel",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=kisisel+deri+valiz+etiketi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 13,
    name: "Taşınabilir Hamak",
    description: "200g ağırlık, iki ağaç arası 5 dakikada kurulum. Seyahatin en rahat molası.",
    price: "₺399 – ₺799",
    emoji: "🌴",
    gradient: "from-lime-800 via-green-700 to-emerald-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=tasinalir+hamak+seyahat&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 14,
    name: "Retro Polaroid Fotoğraf Makinesi",
    description: "Anı çek, anında bas, hediye et. Seyahat anılarını somutlaştırmanın en şirin yolu.",
    price: "₺1.499 – ₺2.999",
    emoji: "📸",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "travel",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=polaroid+fotograf+makinesi",
    shop: "Hepsiburada",
  },
  {
    id: 15,
    name: "Premium Seyahat Makyaj Çantası",
    description: "Düzenli ve şık. Tüm makyaj malzemelerini seyahate taşımak için tasarlanmış.",
    price: "₺299 – ₺699",
    emoji: "💼",
    gradient: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=seyahat+makyaj+cantasi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 16,
    name: "Kompresyon Çorap Seti",
    description: "Uzun uçuşlarda ayak şişmesi ve yorgunluğuna çözüm. Konfor her adımda.",
    price: "₺199 – ₺449",
    emoji: "🧦",
    gradient: "from-stone-700 via-stone-600 to-zinc-600",
    category: "travel",
    occasions: ["surprise", "newyear", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=kompresyon+corap+seyahat&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 17,
    name: "Kamera Çantası (Mirrorless)",
    description: "Seyahat fotoğrafçılığı için şık ve koruyucu kamera çantası. Tam Beril tarzı.",
    price: "₺699 – ₺1.599",
    emoji: "📷",
    gradient: "from-gray-700 via-gray-600 to-zinc-600",
    category: "travel",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=kamera+cantasi+mirrorless",
    shop: "Hepsiburada",
  },
  {
    id: 18,
    name: "Portable Wi-Fi Cihazı",
    description: "Yurtdışında operatör sorunu yok. 30+ ülkede çalışan taşınabilir Wi-Fi.",
    price: "₺999 – ₺2.499",
    emoji: "📡",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "travel",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=portable+wifi+yurtdisi+modem",
    shop: "Hepsiburada",
  },
  {
    id: 19,
    name: "Outdoor Yürüyüş Botu",
    description: "Su geçirmez, hafif ve rahat. Dağ tatilinde, şehir keşfinde her yerde.",
    price: "₺1.499 – ₺3.999",
    emoji: "🥾",
    gradient: "from-amber-900 via-amber-800 to-orange-800",
    category: "travel",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=outdoor+yuruyus+botu+kadin&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 20,
    name: "Seyahat Kilitli Bavul",
    description: "TSA onaylı kilit, 360° tekerlekler, hafif kasa. Seyahatin çok daha akıcı.",
    price: "₺1.999 – ₺4.999",
    emoji: "🧳",
    gradient: "from-red-800 via-red-700 to-rose-700",
    category: "travel",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=kilitli+bavul+tsa+hafif&sst=MOST_RATED",
    shop: "Trendyol",
  },

  // ── BOOK (15) ──
  {
    id: 21,
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
    id: 22,
    name: "Premium Deri Kitap Ayracı Seti",
    description: "Okuyan biri için ideal, kişiselleştirilebilir zarif deri yer imi seti.",
    price: "₺149 – ₺299",
    emoji: "🔖",
    gradient: "from-orange-800 via-amber-700 to-orange-700",
    category: "book",
    occasions: ["valentines", "surprise", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=deri+kitap+ayraci+kisisel&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 23,
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
    id: 24,
    name: "Premium Okuma Lambası",
    description: "Gözleri yormayan sarı ışık, kısılabilir parlaklık. Geceleri kitap için ideal.",
    price: "₺299 – ₺699",
    emoji: "💡",
    gradient: "from-yellow-800 via-amber-700 to-yellow-700",
    category: "book",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=kitap+okuma+lambasi+led&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 25,
    name: "Sesli Kitap Aboneliği (6 Ay)",
    description: "Seyahatte yürürken, spor yaparken kitap. 6 aylık Storytel aboneliği.",
    price: "₺399 – ₺699",
    emoji: "🎙️",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "book",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=storytel+sesli+kitap+abonelik",
    shop: "Hepsiburada",
  },
  {
    id: 26,
    name: "Aylık Kitap Kutusu Aboneliği",
    description: "Her ay kapısına sürpriz bir kitap gelsin. Kuratoryal seçki, şık ambalaj.",
    price: "₺299 – ₺599 /ay",
    emoji: "📬",
    gradient: "from-emerald-800 via-teal-700 to-emerald-700",
    category: "book",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=kitap+abonelik+kutusu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 27,
    name: "Özel Baskı Klasikler Koleksiyonu",
    description: "Bez ciltli, altın yaldızlı özel baskı. Okunmaktan çok sergilenmek için.",
    price: "₺799 – ₺1.999",
    emoji: "📜",
    gradient: "from-amber-900 via-amber-800 to-orange-800",
    category: "book",
    occasions: ["birthday", "anniversary", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=ozel+baskı+klasik+kitap+set&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 28,
    name: "Blue Light Engelleme Gözlüğü",
    description: "Ekran ve kitap okurken göz yorgunluğunu azaltır. Şık çerçeve tasarımı.",
    price: "₺299 – ₺799",
    emoji: "👓",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "book",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=blue+light+engelleyen+gozluk",
    shop: "Hepsiburada",
  },
  {
    id: 29,
    name: "Kitap Standı / Tutucu",
    description: "Eller serbest okuma deneyimi. Masada, yatakta, her yerde kullanılabilir.",
    price: "₺199 – ₺499",
    emoji: "🗂️",
    gradient: "from-stone-700 via-stone-600 to-zinc-600",
    category: "book",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=kitap+standı+tutucu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 30,
    name: "Okuma Oturma Yastığı",
    description: "Yatakta uzun saatler boyunca sırt ağrısı olmadan kitap okumak için.",
    price: "₺399 – ₺799",
    emoji: "🛋️",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "book",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=okuma+yastigi+sirti+destekleyen&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 31,
    name: "Dekoratif Kitaplık Düzenleyici Seti",
    description: "Kitaplığını sanat eserine dönüştüren şık bookend + düzenleyici seti.",
    price: "₺249 – ₺599",
    emoji: "🏛️",
    gradient: "from-slate-700 via-slate-600 to-gray-600",
    category: "book",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=dekoratif+kitaplik+duzenleyici&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 32,
    name: "Kitap Kasası (Gizli Kutu)",
    description: "Kitap görünümünde gizli saklama kutusu. Hem dekoratif hem fonksiyonel.",
    price: "₺199 – ₺449",
    emoji: "🔒",
    gradient: "from-green-900 via-green-800 to-emerald-800",
    category: "book",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=kitap+kasasi+gizli+kutu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 33,
    name: "Premium Not Defteri + Kalem Seti",
    description: "Kaliteli kağıt, şık kapak, iyi bir kalem. Okurken not alan biri için ideal.",
    price: "₺299 – ₺699",
    emoji: "✒️",
    gradient: "from-indigo-800 via-indigo-700 to-blue-700",
    category: "book",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+not+defteri+kalem+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 34,
    name: "Online Yaratıcı Yazarlık Kursu",
    description: "Okuyan biri için doğal bir adım: yazmayı öğrenmek. 3 aylık online kurs.",
    price: "₺499 – ₺1.299",
    emoji: "✍️",
    gradient: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
    category: "book",
    occasions: ["birthday", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=yaratici+yazarlik+online+kurs",
    shop: "Hepsiburada",
  },
  {
    id: 35,
    name: "Kahve + Kitap Hediye Sepeti",
    description: "Dünyaca ünlü single origin kahveler + 2 kitap. En iyi okuma ritüeli.",
    price: "₺499 – ₺999",
    emoji: "☕",
    gradient: "from-amber-800 via-amber-700 to-yellow-700",
    category: "book",
    occasions: ["birthday", "valentines", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=kahve+hediye+sepeti+kitap&sst=MOST_RATED",
    shop: "Trendyol",
  },

  // ── MUSIC (15) ──
  {
    id: 36,
    name: "Gürültü Önleyici Kablosuz Kulaklık",
    description: "Seyahatte müzikle uçmak için ANC özellikli premium kablosuz kulaklık.",
    price: "₺1.999 – ₺4.999",
    emoji: "🎧",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "music",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=anc+kablosuz+kulaklik&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 37,
    name: "Su Geçirmez Bluetooth Hoparlör",
    description: "Plajda, seyahatte, her yerde müzik. Su geçirmez, kompakt ve şık.",
    price: "₺999 – ₺2.499",
    emoji: "🔊",
    gradient: "from-cyan-800 via-cyan-700 to-sky-700",
    category: "music",
    occasions: ["birthday", "anniversary", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=bluetooth+hoparlor+su+gecirmez+tasinalir",
    shop: "Hepsiburada",
  },
  {
    id: 38,
    name: "Spotify / Apple Music Hediye Kartı",
    description: "12 aylık reklamsız, sınırsız müzik keyfi. Anında teslim, hemen aktif.",
    price: "₺799 – ₺999",
    emoji: "🎵",
    gradient: "from-green-800 via-emerald-700 to-green-700",
    category: "music",
    occasions: ["birthday", "valentines", "surprise", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=spotify+hediye+karti",
    shop: "Hepsiburada",
  },
  {
    id: 39,
    name: "Pikap (Vinyl Record Player)",
    description: "Müziği hissettiren deneyim. Retro tasarım, gerçek ses kalitesi. Evinizin yıldızı.",
    price: "₺2.499 – ₺5.999",
    emoji: "🎶",
    gradient: "from-red-800 via-red-700 to-rose-700",
    category: "music",
    occasions: ["birthday", "anniversary", "valentines"],
    buyUrl: "https://www.hepsiburada.com/ara?q=pikap+vinyl+record+player",
    shop: "Hepsiburada",
  },
  {
    id: 40,
    name: "Premium TWS Kulak İçi Kulaklık",
    description: "Şeffaf gövde, aktif gürültü engelleme, 30 saat batarya. Günlük kullanımın en iyisi.",
    price: "₺799 – ₺2.499",
    emoji: "🎵",
    gradient: "from-indigo-800 via-blue-700 to-indigo-700",
    category: "music",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=tws+kulakici+kulaklik+anc&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 41,
    name: "Konser / Festival Etkinlik Bileti",
    description: "Müziği canlı yaşamak bambaşka. Favori sanatçısının konserine iki bilet.",
    price: "₺499 – ₺2.999",
    emoji: "🎤",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "music",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.biletix.com",
    shop: "Biletix",
  },
  {
    id: 42,
    name: "Ukulele Başlangıç Seti",
    description: "Hem eğlenceli hem yaratıcı. Seyahate dahi götürülecek boyutta, şık renklerde.",
    price: "₺799 – ₺1.799",
    emoji: "🎸",
    gradient: "from-amber-800 via-amber-700 to-orange-700",
    category: "music",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=ukulele+baslangic+seti",
    shop: "Hepsiburada",
  },
  {
    id: 43,
    name: "Bluetooth Alarm Saati + Hoparlör",
    description: "Sabahı müzikle başlatmak için. Uyandırıcı değil, sarılıcı saat.",
    price: "₺699 – ₺1.499",
    emoji: "⏰",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "music",
    occasions: ["birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=bluetooth+alarm+saati+hoparlor&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 44,
    name: "Premium Kablolu Referans Kulaklık",
    description: "Stüdyo kalitesinde ses. Müziği gerçekten duyurmak isteyenler için.",
    price: "₺1.299 – ₺3.999",
    emoji: "🎼",
    gradient: "from-stone-700 via-stone-600 to-zinc-600",
    category: "music",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=premium+kablolu+kulaklik+referans",
    shop: "Hepsiburada",
  },
  {
    id: 45,
    name: "Online Müzik / Şan Kursu",
    description: "Müzik sevenin hayali: çalmayı ya da söylemeyi öğrenmek. 3 aylık online kurs.",
    price: "₺499 – ₺1.499",
    emoji: "🎹",
    gradient: "from-purple-800 via-violet-700 to-purple-700",
    category: "music",
    occasions: ["birthday", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=online+muzik+kursu+abonelik",
    shop: "Hepsiburada",
  },
  {
    id: 46,
    name: "Favori Albüm Vinyl LP",
    description: "Sevdiği albümün vinyl baskısı. Pikap varsa anlamlı, yoksa duvar dekorasyonu.",
    price: "₺399 – ₺899",
    emoji: "💿",
    gradient: "from-gray-700 via-gray-600 to-zinc-600",
    category: "music",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=vinyl+lp+plak",
    shop: "Hepsiburada",
  },
  {
    id: 47,
    name: "Kulaklık Standı + Temizleme Kiti",
    description: "Masaüstünü düzenleyen şık stand + premium temizleme seti. Pratik hediye.",
    price: "₺199 – ₺499",
    emoji: "🎯",
    gradient: "from-teal-800 via-teal-700 to-cyan-700",
    category: "music",
    occasions: ["birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=kulaklik+standi+temizleme+kiti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 48,
    name: "Mini Masaüstü Bluetooth Hoparlör",
    description: "Ofiste, evde, her masanın üzerinde yer alabilecek şık küçük hoparlör.",
    price: "₺599 – ₺1.299",
    emoji: "📻",
    gradient: "from-lime-800 via-green-700 to-lime-700",
    category: "music",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=mini+bluetooth+hoparlor+masaustu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 49,
    name: "Müzik Temalı Hediye Sepeti",
    description: "Müzik baskılı kupa + el yapımı çikolata + küçük hoparlör. Keyifli sürpriz.",
    price: "₺399 – ₺799",
    emoji: "🎁",
    gradient: "from-rose-800 via-rose-700 to-pink-700",
    category: "music",
    occasions: ["valentines", "surprise", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=muzik+hediye+sepeti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 50,
    name: "Şarj Edilebilir Boyun Hoparlörü",
    description: "Kulaklık takmadan müzik. Boyunda taşınan 360° ses deneyimi.",
    price: "₺799 – ₺1.999",
    emoji: "🔈",
    gradient: "from-blue-800 via-blue-700 to-indigo-700",
    category: "music",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=boyun+hoparloru+bluetooth",
    shop: "Hepsiburada",
  },

  // ── COSMETIC (15) ──
  {
    id: 51,
    name: "Niche Parfüm",
    description: "Kimsenin taşımadığı, kalıcı ve özel bir koku. Lüks hediye kutusuyla.",
    price: "₺1.499 – ₺3.999",
    emoji: "🌸",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=niche+parfum+kadin&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 52,
    name: "Premium Cilt Bakım Seti",
    description: "Seyahat boyutlu, premium marka cilt bakım rutini. Her seyahatin olmazsa olmazı.",
    price: "₺899 – ₺2.499",
    emoji: "✨",
    gradient: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=cilt+bakim+seti+premium&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 53,
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
    id: 54,
    name: "SPF 50+ Güneş Koruyucu Set",
    description: "Seyahatin vazgeçilmezi. Yüz + vücut için premium güneş koruma seti.",
    price: "₺399 – ₺999",
    emoji: "☀️",
    gradient: "from-yellow-700 via-amber-600 to-yellow-700",
    category: "cosmetic",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=spf+50+gunes+koruyucu+set&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 55,
    name: "Premium Dudak Bakım Seti",
    description: "Laneige, Fresh veya Tatcha kalitesinde dudak bakım rutini. Güzel hediye.",
    price: "₺299 – ₺799",
    emoji: "💋",
    gradient: "from-red-800 via-rose-700 to-red-700",
    category: "cosmetic",
    occasions: ["valentines", "birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+dudak+bakim+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 56,
    name: "Gua Sha + Yüz Masaj Rulosu Seti",
    description: "Doğal taş, anti-aging etki, dinlendirici masaj. Cilt bakımının şık aksesuarı.",
    price: "₺299 – ₺699",
    emoji: "💎",
    gradient: "from-rose-900 via-rose-800 to-pink-800",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=gua+sha+yuz+masaj+rulosu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 57,
    name: "Premium Makyaj Fırçası Seti",
    description: "Profesyonel kalite, yumuşak kıl, şık kılıflı. Makyaj rutinini yükselt.",
    price: "₺499 – ₺1.299",
    emoji: "🖌️",
    gradient: "from-purple-800 via-violet-700 to-purple-700",
    category: "cosmetic",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+makyaj+fircasi+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 58,
    name: "Anti-Aging Göz Kremi (Premium)",
    description: "Klinik test edilmiş, retinol + peptid formüllü. Gerçekten işe yarayan bakım.",
    price: "₺599 – ₺1.499",
    emoji: "👁️",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "cosmetic",
    occasions: ["birthday", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+goz+kremi+anti+aging&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 59,
    name: "Vücut Peeling + Losyon Seti",
    description: "Pürüzsüz cilt için çift aşamalı bakım seti. Doğal içerikli, lüks koku.",
    price: "₺499 – ₺1.199",
    emoji: "🛁",
    gradient: "from-emerald-800 via-teal-700 to-emerald-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=vucut+peeling+losyon+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 60,
    name: "Premium El Kremi Hediye Seti",
    description: "Shea butter, hyaluronic acid, zengin formül. Küçük ama anlamlı hediye.",
    price: "₺199 – ₺599",
    emoji: "🤲",
    gradient: "from-amber-800 via-amber-700 to-orange-700",
    category: "cosmetic",
    occasions: ["valentines", "surprise", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+el+kremi+hediye+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 61,
    name: "Premium Saç Kurutma Makinesi",
    description: "Dyson alternatifi, salon kalitesi evde. Isı korumalı, hızlı kurutucu.",
    price: "₺999 – ₺3.999",
    emoji: "💨",
    gradient: "from-orange-800 via-orange-700 to-amber-700",
    category: "cosmetic",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=premium+sac+kurutma+makinesi",
    shop: "Hepsiburada",
  },
  {
    id: 62,
    name: "LED Işıklı Makyaj Aynası",
    description: "Gündüz ışığı simüle eden LED çerçeve. Makyajı mükemmel yapmanın sırrı.",
    price: "₺499 – ₺1.299",
    emoji: "🪞",
    gradient: "from-slate-700 via-slate-600 to-gray-600",
    category: "cosmetic",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=led+isikli+makyaj+aynasi",
    shop: "Hepsiburada",
  },
  {
    id: 63,
    name: "Ruj Koleksiyonu Hediye Seti",
    description: "Nude'dan boldlara, sezonun en şık renk koleksiyonu. Şık hediye kutusuyla.",
    price: "₺399 – ₺999",
    emoji: "💄",
    gradient: "from-red-800 via-rose-700 to-red-700",
    category: "cosmetic",
    occasions: ["valentines", "birthday", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=ruj+koleksiyon+hediye+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 64,
    name: "Aromaterapi Yüz Buharlaştırıcı",
    description: "Gözenekleri açan, cilt nemini dengeleyen mini spa cihazı. Evde kaplıca.",
    price: "₺399 – ₺899",
    emoji: "🌿",
    gradient: "from-teal-800 via-teal-700 to-cyan-700",
    category: "cosmetic",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=yuz+buharastirici+aromaterapi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 65,
    name: "Serum Koleksiyonu (C Vitamini + Hyaluron)",
    description: "Cilt bakımının yıldız ikilisi. Aydınlatıcı C vitamini + nem bombası hyaluron.",
    price: "₺599 – ₺1.799",
    emoji: "💧",
    gradient: "from-cyan-800 via-sky-700 to-cyan-700",
    category: "cosmetic",
    occasions: ["birthday", "valentines", "anniversary", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=c+vitamini+hyaluron+serum+set&sst=MOST_RATED",
    shop: "Trendyol",
  },

  // ── SPORT (15) ──
  {
    id: 66,
    name: "Premium Yoga Matı",
    description: "Kaymaz yüzey, 6mm kalınlık. Sporty yaşamın şık ve işlevsel aksesuarı.",
    price: "₺599 – ₺1.299",
    emoji: "🧘‍♀️",
    gradient: "from-teal-800 via-teal-700 to-emerald-700",
    category: "sport",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+yoga+mati&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 67,
    name: "Akıllı Saat / Fitness Tracker",
    description: "Adım, nabız, uyku takibi — hepsi bileğinde. Sporty yaşamın teknolojik dostu.",
    price: "₺2.499 – ₺5.999",
    emoji: "⌚",
    gradient: "from-indigo-800 via-indigo-700 to-blue-700",
    category: "sport",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=fitness+tracker+akilli+saat+kadin",
    shop: "Hepsiburada",
  },
  {
    id: 68,
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
    id: 69,
    name: "Pilates Topu + Egzersiz Bandı Seti",
    description: "Eve taşınabilir mini jimnastik. Pilates, yoga ve esneme egzersizleri için.",
    price: "₺299 – ₺699",
    emoji: "⚽",
    gradient: "from-lime-800 via-green-700 to-lime-700",
    category: "sport",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=pilates+topu+egzersiz+bandi+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 70,
    name: "Premium Spor Çantası",
    description: "Spor salonuna, seyahate. Ayrı ayakkabı bölmeli, şık ve geniş spor çantası.",
    price: "₺699 – ₺1.799",
    emoji: "🎒",
    gradient: "from-slate-700 via-slate-600 to-gray-600",
    category: "sport",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+spor+cantasi+kadin&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 71,
    name: "Foam Roller (Kas Toparlanma)",
    description: "Spor sonrası kas ağrılarına doğal çözüm. Fizyoterapistlerin tercihi.",
    price: "₺299 – ₺699",
    emoji: "🏋️‍♀️",
    gradient: "from-orange-800 via-orange-700 to-amber-700",
    category: "sport",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=foam+roller+kas+toparlanma&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 72,
    name: "Masaj Tabancası (Percussive)",
    description: "Spordan sonra derin doku masajı. Profesyonel fizyoterapi cihazı evde.",
    price: "₺1.299 – ₺3.999",
    emoji: "⚡",
    gradient: "from-red-800 via-red-700 to-rose-700",
    category: "sport",
    occasions: ["birthday", "anniversary", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=masaj+tabancasi+percussive",
    shop: "Hepsiburada",
  },
  {
    id: 73,
    name: "Premium Atlama İpi",
    description: "Hız, kilo verme, koordinasyon. Sporcuların tercihi, boncuklu kablo atlama ipi.",
    price: "₺199 – ₺499",
    emoji: "🪢",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "sport",
    occasions: ["birthday", "surprise", "newyear"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+atlama+ipi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 74,
    name: "Yoga Blok + Kayış Seti",
    description: "Esnekliği ve dengeyi geliştiren temel yoga aksesuarları. Başlangıç için ideal.",
    price: "₺249 – ₺549",
    emoji: "🧩",
    gradient: "from-purple-800 via-violet-700 to-purple-700",
    category: "sport",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=yoga+blok+kayis+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 75,
    name: "Premium Spor Çorap Seti",
    description: "Nem emen, kaymaz taban, anatomik tasarım. Her sporlu kişinin ihtiyacı.",
    price: "₺199 – ₺499",
    emoji: "🧦",
    gradient: "from-emerald-800 via-teal-700 to-emerald-700",
    category: "sport",
    occasions: ["birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+spor+corap+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 76,
    name: "Pilates / Barre Online Ders Aboneliği",
    description: "Evden profesyonel ders. 3 aylık online pilates ve barre aboneliği.",
    price: "₺399 – ₺899",
    emoji: "🩰",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "sport",
    occasions: ["birthday", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=pilates+online+ders+abonelik",
    shop: "Hepsiburada",
  },
  {
    id: 77,
    name: "Balance Board (Denge Tahtası)",
    description: "Core kaslarını geliştiren denge tahtası. Evde çalışırken bile kullanılabilir.",
    price: "₺599 – ₺1.299",
    emoji: "🏄‍♀️",
    gradient: "from-amber-800 via-amber-700 to-orange-700",
    category: "sport",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=balance+board+denge+tahtasi&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 78,
    name: "Kemik İletimli Koşu Kulaklığı",
    description: "Dışarıdaki sesleri duyarken müzik. Koşu ve outdoor aktiviteler için güvenli.",
    price: "₺1.299 – ₺2.999",
    emoji: "🎧",
    gradient: "from-cyan-800 via-sky-700 to-cyan-700",
    category: "sport",
    occasions: ["birthday", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=kemik+iletimli+kulaklik+kosus",
    shop: "Hepsiburada",
  },
  {
    id: 79,
    name: "Sporty Güneş Gözlüğü",
    description: "UV400 korumalı, polarize cam, hafif çerçeve. Outdoor aktiviteler için ideal.",
    price: "₺399 – ₺1.299",
    emoji: "😎",
    gradient: "from-gray-700 via-gray-600 to-zinc-600",
    category: "sport",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=sporty+polarize+gunes+gozlugu&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 80,
    name: "Premium Yoga Taytı + Sports Bra Seti",
    description: "Yüksek bel, sıkıştırıcı değil destekleyici. Hareket özgürlüğü + stil.",
    price: "₺599 – ₺1.799",
    emoji: "👗",
    gradient: "from-fuchsia-800 via-pink-700 to-fuchsia-700",
    category: "sport",
    occasions: ["birthday", "newyear", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=yoga+tayti+sports+bra+set+kadin&sst=MOST_RATED",
    shop: "Trendyol",
  },

  // ── LIFESTYLE (20) ──
  {
    id: 81,
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
    id: 82,
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
    id: 83,
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
    id: 84,
    name: "Kişiselleştirilmiş Takı",
    description: "Adı veya özel tarihi yazılan zarif bileklik ya da kolye. Ona özel.",
    price: "₺499 – ₺1.599",
    emoji: "💎",
    gradient: "from-rose-900 via-rose-800 to-pink-800",
    category: "lifestyle",
    occasions: ["valentines", "anniversary", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=kisisel+isimli+taki+bileklik&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 85,
    name: "Single Origin Kahve + French Press",
    description: "Dünyadan seçme kahveler + kaliteli French Press. Kahve ritüelini yükselt.",
    price: "₺599 – ₺1.299",
    emoji: "☕",
    gradient: "from-amber-800 via-amber-700 to-yellow-700",
    category: "lifestyle",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=single+origin+kahve+french+press&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 86,
    name: "Premium Çay Koleksiyonu + Demlik",
    description: "Dünyanın dört bir yanından seçme çaylar + şık cam demlik. Çay ritüeli.",
    price: "₺399 – ₺899",
    emoji: "🍵",
    gradient: "from-green-800 via-emerald-700 to-green-700",
    category: "lifestyle",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+cay+koleksiyonu+demlik&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 87,
    name: "Fotoğraf Kolajı Baskı Hediyesi",
    description: "En güzel anlar bir çerçevede. Polaroid tarz kolaj baskı veya canvas.",
    price: "₺299 – ₺799",
    emoji: "🖼️",
    gradient: "from-pink-800 via-rose-700 to-pink-700",
    category: "lifestyle",
    occasions: ["valentines", "anniversary", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=fotograf+kolaj+baskı+cerceve&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 88,
    name: "Premium Ajanda / Planner 2026",
    description: "Hedefleri, yolculukları, planları takip etmek için şık haftalık planner.",
    price: "₺299 – ₺699",
    emoji: "📅",
    gradient: "from-indigo-800 via-indigo-700 to-blue-700",
    category: "lifestyle",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+ajanda+planner+2026&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 89,
    name: "İpek Yastık Kılıfı Seti",
    description: "Saç ve cilt dostu %100 doğal ipek. Uyku kalitesini artıran şık yastık kılıfı.",
    price: "₺499 – ₺1.299",
    emoji: "🌙",
    gradient: "from-purple-800 via-violet-700 to-purple-700",
    category: "lifestyle",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=ipek+yastik+kilifi+%100+dogal&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 90,
    name: "Aromaterapi Difüzörü + Uçucu Yağ Seti",
    description: "Evi spa'ya dönüştür. Lavandar, ökaliptüs, gül — tam 10 koku seçeneği.",
    price: "₺399 – ₺899",
    emoji: "🌿",
    gradient: "from-teal-800 via-teal-700 to-cyan-700",
    category: "lifestyle",
    occasions: ["birthday", "surprise", "valentines"],
    buyUrl: "https://www.trendyol.com/sr?q=aromaterapi+difuzor+ucucu+yag+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 91,
    name: "Premium Bornoz",
    description: "Hotel lüksünü eve taşı. %100 pamuk, yumuşak ve emen, monogramlı.",
    price: "₺699 – ₺1.799",
    emoji: "🛀",
    gradient: "from-sky-800 via-blue-700 to-sky-700",
    category: "lifestyle",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+bornoz+pamuk&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 92,
    name: "Fine Dining Restoran Hediye Kartı",
    description: "Unutulmaz bir akşam yemeği deneyimi. Şehrin en iyi restoranlarında.",
    price: "₺1.499 – ₺4.999",
    emoji: "🍽️",
    gradient: "from-slate-700 via-slate-600 to-gray-600",
    category: "lifestyle",
    occasions: ["valentines", "anniversary", "birthday"],
    buyUrl: "https://www.trendyol.com/sr?q=restoran+hediye+karti+deneyim&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 93,
    name: "Online Yemek Kursu Aboneliği",
    description: "Dünya mutfaklarını öğren, evde restoran deneyimi yarat. 3 aylık kurs.",
    price: "₺499 – ₺1.299",
    emoji: "👨‍🍳",
    gradient: "from-orange-800 via-orange-700 to-amber-700",
    category: "lifestyle",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=online+yemek+kursu+abonelik",
    shop: "Hepsiburada",
  },
  {
    id: 94,
    name: "Meditation App Aboneliği (Calm/Headspace)",
    description: "Zihni dinginleştir. 1 yıllık premium meditation ve uyku hikayeleri aboneliği.",
    price: "₺399 – ₺799",
    emoji: "🧘",
    gradient: "from-violet-800 via-purple-700 to-violet-700",
    category: "lifestyle",
    occasions: ["birthday", "newyear", "surprise"],
    buyUrl: "https://www.hepsiburada.com/ara?q=calm+headspace+abonelik+hediye",
    shop: "Hepsiburada",
  },
  {
    id: 95,
    name: "Premium Şarap + Peynir Hediye Sepeti",
    description: "Şık ambalaj, seçilmiş şarap, özel peynirler. Hep birlikte açılacak hediye.",
    price: "₺799 – ₺2.499",
    emoji: "🍷",
    gradient: "from-red-900 via-red-800 to-rose-800",
    category: "lifestyle",
    occasions: ["valentines", "anniversary", "birthday", "surprise"],
    buyUrl: "https://www.trendyol.com/sr?q=sarap+peynir+hediye+sepeti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 96,
    name: "Kişiselleştirilmiş Takı Kutusu",
    description: "İsmi veya özel mesajı oyulmuş şık mücevher kutusu. Her gece yatmadan önce.",
    price: "₺399 – ₺899",
    emoji: "💝",
    gradient: "from-rose-800 via-rose-700 to-pink-700",
    category: "lifestyle",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=kisisel+taki+kutusu+isimli&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 97,
    name: "Dijital Fotoğraf Çerçevesi",
    description: "Binlerce anı bir çerçevede. Telefondaki fotoğraflar her gün salonda.",
    price: "₺899 – ₺2.499",
    emoji: "🖼️",
    gradient: "from-gray-700 via-gray-600 to-zinc-600",
    category: "lifestyle",
    occasions: ["birthday", "valentines", "anniversary"],
    buyUrl: "https://www.hepsiburada.com/ara?q=dijital+fotograf+cercevesi+wifi",
    shop: "Hepsiburada",
  },
  {
    id: 98,
    name: "El Yapımı Çikolata Hediye Seti",
    description: "Belçika çikolatası, sıra dışı tatlar, şık ambalaj. Herkesi mutlu eden hediye.",
    price: "₺299 – ₺799",
    emoji: "🍫",
    gradient: "from-amber-900 via-amber-800 to-brown-800",
    category: "lifestyle",
    occasions: ["valentines", "birthday", "surprise", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=el+yapimi+cikolata+hediye+seti&sst=MOST_RATED",
    shop: "Trendyol",
  },
  {
    id: 99,
    name: "Online Kişisel Gelişim Kursu",
    description: "Kariyer, üretkenlik veya mindfulness. Yılbaşının en anlamlı hediyesi.",
    price: "₺499 – ₺1.999",
    emoji: "🚀",
    gradient: "from-blue-800 via-blue-700 to-indigo-700",
    category: "lifestyle",
    occasions: ["birthday", "newyear"],
    buyUrl: "https://www.hepsiburada.com/ara?q=online+kisisel+gelisim+kursu",
    shop: "Hepsiburada",
  },
  {
    id: 100,
    name: "Premium Güneş Gözlüğü",
    description: "UV400 koruma, polarize cam, ikonik çerçeve. Seyahatin en şık aksesuarı.",
    price: "₺799 – ₺2.999",
    emoji: "🕶️",
    gradient: "from-zinc-700 via-zinc-600 to-neutral-600",
    category: "lifestyle",
    occasions: ["birthday", "surprise", "valentines", "anniversary"],
    buyUrl: "https://www.trendyol.com/sr?q=premium+gunes+gozlugu+kadin&sst=MOST_RATED",
    shop: "Trendyol",
  },
];

const SESSION_SIZE = 20;

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
    // Fisher-Yates shuffle
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    setSelectedOccasion(occasion);
    setProducts(filtered.slice(0, SESSION_SIZE));
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
    ? swipeFeedback === "right" ? 15 : -15
    : dragX * 0.1;
  const cardTranslateX = swipeFeedback
    ? swipeFeedback === "right" ? 400 : -400
    : dragX;
  const likeOpacity = Math.min(1, Math.max(0, (dragX > 0 ? dragX : 0) / 60));
  const passOpacity = Math.min(1, Math.max(0, (dragX < 0 ? -dragX : 0) / 60));

  const currentProduct = products[currentIndex];
  const nextProduct = products[currentIndex + 1];
  const progress = products.length > 0 ? (currentIndex / products.length) * 100 : 0;
  const occasionLabel = OCCASIONS.find((o) => o.id === selectedOccasion)?.label ?? "";

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
              onClick={() => { setStep("occasion"); setDragX(0); setSwipeFeedback(null); }}
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
                Beril&apos;e doğru hediyeyi bulalım. Hangi özel gün için arıyorsun?
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
                  <div className="self-start">
                    <span className="text-[11px] font-medium text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
                      {CATEGORY_LABELS[currentProduct.category]}
                    </span>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <span
                      className="select-none"
                      style={{ fontSize: 120, lineHeight: 1, filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.4))" }}
                    >
                      {currentProduct.emoji}
                    </span>
                  </div>

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

            <p className="text-xs text-white/25 text-center">Sürükle veya aşağıdaki butonları kullan</p>

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
            <div className="text-center">
              <div className="text-4xl mb-3">{liked.length > 0 ? "🎉" : "😕"}</div>
              <h2 className="text-xl font-bold text-white mb-1">
                {liked.length > 0 ? `${liked.length} harika hediye seçtin!` : "Hiç beğenmedin..."}
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
                        <p className="font-semibold text-white text-sm leading-tight truncate">{product.name}</p>
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
                  💡 Emin olamadın mı? &quot;Hemen Al&quot; linkine tıkla, incele, sonra karar ver.
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

      <footer className="w-full border-t border-white/5 py-3 px-4">
        <p className="text-center text-[10px] text-white/15">
          Beril&apos;e özel · <a href="https://orhankarakopru.com.tr" className="hover:text-white/30 transition-colors">orhankarakopru.com.tr</a>
        </p>
      </footer>
    </div>
  );
}
