type GroqMessage = {
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

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      temperature,
      messages
    })
  });

  const data = await res.json();

  return (
    data?.choices?.[0]?.message?.content ??
    "Groq yanıt üretemedi."
  );
}
