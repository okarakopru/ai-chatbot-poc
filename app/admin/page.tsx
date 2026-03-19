import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "../api/auth/[...nextauth]/options";
import { getMetrics } from "../../lib/adminMetrics";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  const metrics = getMetrics();

  // Son 24 saat için saatlik veri hazırla
  const hours = getLast24Hours();
  const series = hours.map((h) => metrics.hourlyMessages[h] || 0);
  const maxValue = Math.max(1, ...series);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <p className="text-gray-400 mb-10">
        Hoş geldin <strong>{session.user?.email}</strong>
      </p>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard title="Toplam Chat" value={metrics.totalChats} subtitle="Başlatılan sohbet" />
        <MetricCard title="Toplam Mesaj" value={metrics.totalMessages} subtitle="User mesajı" />
        <MetricCard title="Başarılı Cevap" value={metrics.totalCompletions} subtitle="Assistant cevap" />
        <MetricCard title="Hata Sayısı" value={metrics.totalErrors} subtitle="API / timeout" />
      </div>

      {/* PERFORMANCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <MetricCard
          title="Ortalama Yanıt Süresi"
          value={`${metrics.avgLatencyMs} ms`}
          subtitle="OpenAI latency"
        />
        <MetricCard
          title="Metrik Başlangıcı"
          value={new Date(metrics.startedAt).toLocaleString()}
          subtitle="Server start"
        />
      </div>

      {/* HOURLY CHART */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">Son 24 Saat Mesaj Trendi</h2>
        <LineChart data={series} max={maxValue} labels={hours.map((h) => h.slice(11))} />
      </div>

      {/* LAST REQUESTS */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">Son İstekler</h2>
        <div className="space-y-2 text-sm">
          {metrics.lastRequests.length === 0 && (
            <p className="text-gray-400">Henüz istek yok.</p>
          )}
          {metrics.lastRequests.map((r, i) => (
            <div key={i} className="flex justify-between border-b border-gray-800 pb-1">
              <span className="text-gray-400">
                {new Date(r.at).toLocaleTimeString()}
              </span>
              <span className="text-gray-300">{r.latencyMs} ms</span>
              <span className={r.ok ? "text-green-400" : "text-red-400"}>
                {r.ok ? "OK" : "ERR"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* LOGOUT */}
      <form action="/api/auth/signout" method="post">
        <button className="text-sm text-red-400 hover:underline">Çıkış yap</button>
      </form>
    </main>
  );
}

/* ---------- Helpers & Components ---------- */

function MetricCard({
  title,
  value,
  subtitle
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h3 className="text-sm text-gray-400 mb-1">{title}</h3>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function getLast24Hours(): string[] {
  const hours: string[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    hours.push(d.toISOString().slice(0, 13)); // YYYY-MM-DDTHH
  }
  return hours;
}

function LineChart({
  data,
  max,
  labels
}: {
  data: number[];
  max: number;
  labels: string[];
}) {
  const width = 800;
  const height = 200;
  const padding = 20;

  const points = data.map((v, i) => {
    const x = padding + (i * (width - 2 * padding)) / (data.length - 1);
    const y = height - padding - (v / max) * (height - 2 * padding);
    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="w-full">
        {/* Axes */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#374151" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#374151" />

        {/* Line */}
        <polyline
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          points={points.join(" ")}
        />

        {/* Dots */}
        {data.map((v, i) => {
          const x = padding + (i * (width - 2 * padding)) / (data.length - 1);
          const y = height - padding - (v / max) * (height - 2 * padding);
          return <circle key={i} cx={x} cy={y} r="3" fill="#22c55e" />;
        })}
      </svg>

      {/* X labels */}
      <div className="grid grid-cols-12 text-xs text-gray-500 mt-2">
        {labels.map((l, i) => (
          <span key={i} className="text-center">{l}</span>
        ))}
      </div>
    </div>
  );
}
