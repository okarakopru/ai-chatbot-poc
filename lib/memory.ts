/**
 * Uzun süreli hafıza — Upstash Redis REST API
 * Paket gerektirmez, sadece fetch kullanır.
 *
 * Key: memory:{hashedIp}
 * Value: { summary, topics, lastSeen, messageCount }
 * TTL: 30 gün
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gün

type Memory = {
  summary: string;
  topics: string[];
  lastSeen: string;
  messageCount: number;
};

function redisHeaders() {
  return {
    Authorization: `Bearer ${REDIS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: redisHeaders(),
    });
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: redisHeaders(),
      body: JSON.stringify([value, "EX", ttl]),
    });
  } catch {
    // sessizce geç, hafıza kritik değil
  }
}

// IP'yi hash'le (privacy)
async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "orhan-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// Geçmiş hafızayı yükle
export async function loadMemory(ip: string): Promise<Memory | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const hash = await hashIp(ip);
    const raw = await redisGet(`memory:${hash}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Eski Redis kayıtlarında 'topics' olmayabilir — varsayılan değerlerle normalize et
    return {
      summary: parsed.summary ?? "",
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      lastSeen: parsed.lastSeen ?? "",
      messageCount: parsed.messageCount ?? 0,
    };
  } catch {
    return null;
  }
}

// Sohbetten topic'leri çıkar ve hafızayı güncelle
export async function saveMemory(
  ip: string,
  messages: { role: string; content: string }[],
  existingMemory: Memory | null
): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  if (messages.length < 2) return;

  try {
    const hash = await hashIp(ip);

    // Kullanıcı mesajlarından konuları çıkar
    const userMessages = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.slice(0, 100));

    // Basit özet — ilk soru + konu sayısı
    const firstQ = userMessages[0] ?? "";
    const messageCount = (existingMemory?.messageCount ?? 0) + messages.filter(m => m.role === "user").length;

    // Topic'leri birleştir (eskiler + yeniler, max 10)
    const newTopics = userMessages.slice(0, 3);
    const allTopics = [...(existingMemory?.topics ?? []), ...newTopics].slice(-10);

    const memory: Memory = {
      summary: firstQ.slice(0, 150),
      topics: allTopics,
      lastSeen: new Date().toLocaleDateString("tr-TR"),
      messageCount,
    };

    await redisSet(`memory:${hash}`, JSON.stringify(memory), TTL_SECONDS);
  } catch {
    // sessizce geç
  }
}

// Hafızayı prompt için formatlı string'e çevir
export function formatMemoryForPrompt(memory: Memory): string {
  const topicList = (memory.topics ?? []).slice(-5).join(" / ");
  return (
    `Bu kullanıcı daha önce seninle konuştu (${memory.lastSeen}). ` +
    `Toplam ${memory.messageCount} mesaj gönderdi. ` +
    `İlk sorusu: "${memory.summary}". ` +
    `Konuştuğu konular: ${topicList}. ` +
    `Bu bağlamı kullanarak sohbete devam et — "Daha önce X'i konuşmuştuk" gibi doğal bir geçiş yapabilirsin.`
  );
}
