import { NextRequest } from "next/server";

export const runtime = "nodejs";

type LabMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function pickModel(message: string, selected: string) {
  const text = message.toLowerCase();

  if (selected === "openai") return "openai";
  if (selected === "groq") return "groq";

  // auto
  if (text.includes("sunum") || text.includes("ppt") || text.includes("slide")) {
    return "openai";
  }

  if (text.includes("code") || text.includes("refactor") || text.includes("debug")) {
    return "groq";
  }

  return "openai";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    message,
    history = [],
    model = "auto",
    temperature = 0.7,
    systemPrompt = ""
  } = body;

  const picked = pickModel(message, model);

  // Şimdilik her şey OpenAI'ye düşüyor (Groq sonraki adım)
  const finalModel = "gpt-4o-mini";

  const messages: LabMessage[] = [
    ...(systemPrompt
      ? [{ role: "system", content: systemPrompt }]
      : []),
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
      model: finalModel,
      temperature,
      messages
    })
  });

  const data = await res.json();
  const answer =
    data?.choices?.[0]?.message?.content ??
    "Yanıt üretilemedi.";

  return Response.json({
    answer,
    usedModel: picked
  });
}
