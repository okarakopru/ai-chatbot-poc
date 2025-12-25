type Metrics = {
  startedAt: string;          // metriklerin başladığı zaman
  totalChats: number;         // kaç chat başlatıldı (ilk user mesajı)
  totalMessages: number;      // toplam user mesajı
  totalCompletions: number;   // toplam assistant cevabı
  totalErrors: number;        // toplam hata
  avgLatencyMs: number;       // ortalama latency
  lastRequests: Array<{
    at: string;
    ip: string;
    latencyMs: number;
    ok: boolean;
  }>;
};

const g = globalThis as any;

// Global memory store (Render restart ederse sıfırlanır)
if (!g.__ORHANGPT_METRICS__) {
  g.__ORHANGPT_METRICS__ = {
    startedAt: new Date().toISOString(),
    totalChats: 0,
    totalMessages: 0,
    totalCompletions: 0,
    totalErrors: 0,
    avgLatencyMs: 0,
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

export function recordMessage(latencyMs: number, ok: boolean, ip: string) {
  const m = getMetrics();
  m.totalMessages += 1;

  if (ok) m.totalCompletions += 1;
  else m.totalErrors += 1;

  // Running average
  const n = m.totalMessages;
  m.avgLatencyMs = Math.round(((m.avgLatencyMs * (n - 1)) + latencyMs) / n);

  m.lastRequests.unshift({
    at: new Date().toISOString(),
    ip,
    latencyMs,
    ok
  });

  // Son 25 kaydı tut
  if (m.lastRequests.length > 25) m.lastRequests.length = 25;
}
