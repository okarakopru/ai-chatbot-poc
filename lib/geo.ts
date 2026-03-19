export type GeoResult = {
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
};

function cleanIp(raw: string | null): string {
  if (!raw) return "unknown";
  return raw.split(",")[0].trim();
}

export function extractClientIp(headers: Headers): string {
  return cleanIp(
    headers.get("x-forwarded-for") ||
    headers.get("x-real-ip")
  );
}

export function maskIp(ip: string) {
  if (!ip || ip === "unknown") return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return ip.slice(0, 6) + "…";
}

export async function lookupGeo(ip: string): Promise<GeoResult> {
  if (!ip || ip === "unknown") return { ip: "unknown" };

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return { ip };

    const data: any = await res.json();
    return {
      ip,
      city: data?.city,
      region: data?.region,
      country: data?.country_name
    };
  } catch {
    return { ip };
  }
}
