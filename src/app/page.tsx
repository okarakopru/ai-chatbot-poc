"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "orhan-gpt-history";

const SUGGESTED_QUESTIONS = [
  "PM olmadan önce ne yapıyordun?",
  "En büyük başarın neydi?",
  "AI hakkında ne düşünüyorsun?",
  "Kariyer hedefin ne?",
  "İyi bir PM'i nasıl tanımlarsın?",
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Merhaba 👋 Ben **Orhan**.\n\nBurada benimle birebir sohbet ediyormuş gibi düşünebilirsin. Kariyerim, ürün yönetimi ya da **AI** ile ilgili aklına gelen her şeyi sorabilirsin.",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: Message[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
          setHydrated(true);
          return;
        }
      } catch {
        // invalid data, start fresh
      }
    }
    setMessages([WELCOME_MESSAGE]);
    setHydrated(true);
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([WELCOME_MESSAGE]);
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input;
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: "user", content: messageText };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setTypingText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages,
        }),
      });

      const data = await res.json();
      const fullText: string = data.answer ?? "";

      if (!fullText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Şu an cevap veremedim, tekrar dener misin?" },
        ]);
        setLoading(false);
        setTypingText("");
        return;
      }

      let index = 0;
      const length = fullText.length;
      const speed = length < 200 ? 25 : length < 600 ? 15 : 8;

      const interval = setInterval(() => {
        index++;
        setTypingText(fullText.slice(0, index));

        if (index >= fullText.length) {
          clearInterval(interval);
          setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
          setTypingText("");
          setLoading(false);
        }
      }, speed);

      setTimeout(() => {
        clearInterval(interval);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev;
          return [...prev, { role: "assistant", content: fullText }];
        });
        setTypingText("");
        setLoading(false);
      }, 15000);
    } catch (error) {
      console.error("SEND MESSAGE ERROR:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bir hata oluştu, tekrar dener misin?" },
      ]);
      setTypingText("");
      setLoading(false);
    }
  }

  const isConversationStarted = messages.length > 1;

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-gray-800 flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold">OrhanGPT</h1>
          <p className="text-gray-400 text-sm mt-1">
            Orhan Karaköprü&apos;nün dijital ikizi
          </p>
        </div>
        {isConversationStarted && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg"
          >
            Sohbeti temizle
          </button>
        )}
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-2xl ${
              msg.role === "user" ? "ml-auto text-right" : "mr-auto"
            }`}
          >
            <div
              className={`inline-block px-4 py-3 rounded-2xl leading-relaxed ${
                msg.role === "user"
                  ? "bg-white text-black"
                  : "bg-gray-900 border border-gray-800"
              }`}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Typing effect */}
        {typingText && (
          <div className="max-w-2xl mr-auto">
            <div className="inline-block px-4 py-3 rounded-2xl bg-gray-900 border border-gray-800 text-gray-200 leading-relaxed">
              <ReactMarkdown>{typingText}</ReactMarkdown>
              <span className="animate-pulse">▍</span>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {loading && !typingText && (
          <div className="text-gray-500 text-sm">Bir saniye, düşünüyorum…</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — only when not started */}
      {!isConversationStarted && !loading && (
        <div className="px-6 pb-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-sm text-gray-300 border border-gray-700 hover:border-gray-400 hover:text-white px-4 py-2 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="p-6 border-t border-gray-800">
        <div className="max-w-3xl mx-auto flex gap-4">
          <textarea
            rows={2}
            className="flex-1 resize-none rounded-xl bg-gray-900 border border-gray-700 p-4 focus:outline-none focus:ring-2 focus:ring-white"
            placeholder="Kariyerim, ürün yönetimi veya AI hakkında bir soru sor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="bg-white text-black font-semibold px-6 rounded-xl disabled:opacity-50"
          >
            Gönder
          </button>
        </div>
      </footer>
    </main>
  );
}
