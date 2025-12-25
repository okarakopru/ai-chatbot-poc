import { NextRequest } from "next/server";
import { chatWithGroq } from "../../../../lib/groq";

export const runtime = "nodejs";

type LabMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Router v1
 * - openai  → gpt-4o-mini
 * - groq    → llama-3.1-70b-versatile
 * - auto    → heuristic
 */
function pickModel(
  userMessage: string,
  selected: "auto" | "openai" | "groq"
): "openai" | "groq" {
  const text = userMessage.toLowerCase();

  if (selected === "openai") return "openai";
  if (selected === "groq") return "groq";

  // auto routing
  if (
    text.includes("code") ||
    text.includes("refactor") ||
    text.includes("debug") ||
    text.includes("hata")
  ) {
    return "groq";
  }

  if (
    text.includes("sunum") ||
    text.includes("slide") ||
    text.includes("ppt") ||
    text.includes("deck")
  ) {
    return "openai";
  }

  return "openai";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      model = "auto",
      temperature = 0.7,
      systemPrompt
    } = body as {
      message: string;
      history?: LabMessage[];
      model?: "auto" | "openai" | "groq";
      temperature?: number;
      systemPrompt?: string;
    };

    const picked = pickModel(message, model);

    // 👇 system message'i ayrı ve typed oluştur
    const systemMessages: LabMessage[] = systemPrompt
      ? [{ role: "system", content: systemPrompt }]
      : [];

    const messages: LabMessage[] = [
      ...systemMessages,
      ...history,
      { role: "user", content: message }
    ];

    let answer = "";

   if (picked === "groq") {
  try {
    answer = await chatWithGroq(messages, temperature);
  } catch (err) {
    console.error("GROQ FAILED, FALLBACK TO OPENAI", err);

    // fallback to OpenAI
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature,
        messages
      })
    });

    const data = await res.json();
    answer =
      data?.choices?.[0]?.message?.content ??
      "Yanıt üretilemedi.";
        }
    }

    return Response.json({
      answer,
      usedModel: picked
    });
  } catch (err) {
    console.error("LAB CHAT ERROR:", err);
    return Response.json(
      { answer: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
