import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "../../auth/[...nextauth]/options";
import { getMetrics } from "../../../../lib/adminMetrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // 🔐 Sadece admin erişebilir
  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const metrics = getMetrics();

  return Response.json(metrics);
}
