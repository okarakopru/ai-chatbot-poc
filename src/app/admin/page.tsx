import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/options";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <p className="text-gray-400 mb-8">
        Hoş geldin <strong>{session.user?.email}</strong>
      </p>

      <div className="space-y-4">
        <div className="p-4 rounded bg-gray-900 border border-gray-800">
          <h2 className="font-semibold">📊 Analytics</h2>
          <p className="text-sm text-gray-400">
            Buraya birazdan chat kullanım istatistikleri gelecek.
          </p>
        </div>

        <div className="p-4 rounded bg-gray-900 border border-gray-800">
          <h2 className="font-semibold">⚙️ Sistem</h2>
          <p className="text-sm text-gray-400">
            API hata sayıları, timeout’lar vs.
          </p>
        </div>
      </div>

      <form action="/api/auth/signout" method="post" className="mt-10">
        <button className="text-sm text-red-400 hover:underline">
          Çıkış yap
        </button>
      </form>
    </main>
  );
}
