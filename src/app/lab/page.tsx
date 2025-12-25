"use client";

import { useState } from "react";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

export default function LabPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("auto");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");

  async function send() {
    if (!input.trim()) return;

    const userMsg: Msg = { role: "user", content: input };
    setMessages((p) => [...p, userMsg]);
    setInput("");

    const res = await fetch("/api/lab/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMsg.content,
        history: messages,
        model,
        temperature,
        systemPrompt
      })
    });

    const data = await res.json();
    setMessages((p) => [
      ...p,
      { role: "assistant", content: data.answer }
    ]);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">OrhanGPT Lab</h1>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-2 rounded"
        >
          <option value="auto">Auto</option>
          <option value="openai">OpenAI</option>
          <option value="groq">Groq (yakında)</option>
        </select>

        <input
          type="number"
          step="0.1"
          min="0"
          max="1"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 p-2 rounded"
          placeholder="Temperature"
        />

        <input
          type="text"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-2 rounded"
          placeholder="System prompt (opsiyonel)"
        />
      </div>

      {/* Chat */}
      <div className="space-y-3 mb-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded max-w-xl ${
              m.role === "user"
                ? "bg-white text-black ml-auto"
                : "bg-gray-900 border border-gray-800"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 p-3 rounded"
          placeholder="Lab mesajı..."
        />
        <button
          onClick={send}
          className="bg-white text-black px-4 rounded"
        >
          Gönder
        </button>
      </div>
    </main>
  );
}
