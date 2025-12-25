export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatWithGroq(
  messages: GroqMessage[],
  temperature: number
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY missing");
  }

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // 🔥 MODEL ADINI DÜZELTİYORUZ
        model: "llama-3.1-70b-versatile",
        temperature,
        messages
      })
    }
  );

  const data = await res.json();

  // 🔥 DEBUG LOG (Render Logs'ta göreceğiz)
  console.log("GROQ RAW RESPONSE:", JSON.stringify(data));

  if (data?.error) {
    throw new Error(
      `Groq error: ${data.error.message || "unknown"}`
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq response missing content");
  }

  return content;
}
