type Metrics = {
  startedAt: string;                 // metriklerin başladığı zaman
  totalChats: number;                // başlatılan chat sayısı
  totalMessages: number;             // toplam user mesajı
  totalCompletions: number;          // başarılı assistant cevapları
  totalErrors: number;               // hata sayısı
  avgLatencyMs: number;              // ortalama cevap süresi
  hourlyMessages: Record<string, number>; // saatlik mesaj sayısı
  lastRequests: Array<{
    at: string;
    ip: string;
    latencyMs: number;
    ok: boolean;
  }>;
};

const g = globalThis as any;

// Global in-memory metrics store
if (!g.__ORHANGPT_METRICS__) {
  g.__ORHANGPT_METRICS__ = {
    startedAt: new Date().toISOString(),
    totalChats: 0,
    totalMessages: 0,
    totalCompletions: 0,
    totalErrors: 0,
    avgLatencyMs: 0,
    hourlyMessages: {},
    lastRequests: []
  } as Metrics;
}

export function getMetrics(): Metrics {
  return g.__ORHANGPT_METRICS__ as Metrics;
}

export function recordChatStarted() {
  const m = getMetrics();
  m.totalChats += 1;
}

export function recordMessage(
  latencyMs: number,
  ok: boolean,
  ip: string
) {
  const m = getMetrics();

  m.totalMessages += 1;

  if (ok) {
    m.totalCompletions += 1;
  } else {
    m.totalErrors += 1;
  }

  // Ortalama latency (running average)
  const n = m.totalMessages;
  m.avgLatencyMs = Math.round(
    ((m.avgLatencyMs * (n - 1)) + latencyMs) / n
  );

  // Saatlik mesaj bucket (YYYY-MM-DDTHH)
  const hourKey = new Date().toISOString().slice(0, 13);
  m.hourlyMessages[hourKey] =
    (m.hourlyMessages[hourKey] || 0) + 1;

  // Son istekler listesi
  m.lastRequests.unshift({
    at: new Date().toISOString(),
    ip,
    latencyMs,
    ok
  });

  // Sadece son 25 isteği tut
  if (m.lastRequests.length > 25) {
    m.lastRequests.length = 25;
  }
}
