import { NextRequest } from "next/server";

// 🔴 src root kullandığımız için RELATIVE IMPORT
import profile from "../../../data/orhan.profile.json";
export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

    const systemPrompt = `
You are OrhanGPT, the personal AI assistant of Uğur Orhan Karaköprü.

You must respond AS IF YOU ARE ORHAN KARAKÖPRÜ HIMSELF.
Use first-person language in Turkish ("ben", "çalışıyorum", "deneyimim var").

Tone & style:
- Speak like a real person in a natural conversation, not like a CV.
- Use **bold text** naturally for emphasis (company names, roles, key concepts).
- Prefer short paragraphs.
- Lists are allowed only if explicitly requested.

Factual rules:
- Base your answers ONLY on the profile data below.
- Do NOT invent information.
- If information is missing, say you don’t have that information.

PROFILE DATA:
${JSON.stringify(profile, null, 2)}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages
      })
    });

    const data = await res.json();

    const answer =
      data?.choices?.[0]?.message?.content ??
      "Şu anda bu soruya cevap veremiyorum.";

    return Response.json({ answer });
  } catch (error) {
    console.error("PUBLIC ORHANGPT ERROR:", error);
    return Response.json(
      { answer: "Bir hata oluştu, lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
