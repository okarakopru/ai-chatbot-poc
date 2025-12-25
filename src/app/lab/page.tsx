import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/options";

export default async function LabPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin");

  return (
    <main className="min-h-screen bg-gray-950 text-white p-10">
      <h1 className="text-3xl font-bold mb-2">OrhanGPT Lab</h1>
      <p className="text-gray-400 mb-8">
        Burası sadece senin kullanımın için. Çoklu model hub + doküman + araçlar.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Durum</h2>
        <p className="text-sm text-gray-400">
          Lab UI (chat) bir sonraki adımda eklenecek.
        </p>
      </div>
    </main>
  );
}
