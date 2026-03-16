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
    "Merhaba! Ben **Orhan**.\n\nKariyerim, ürün yönetimi ya da AI hakkında aklına gelen her şeyi sorabilirsin.",
};

function Avatar({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm select-none"
    >
      OK
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

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
        // invalid data
      }
    }
    setMessages([WELCOME_MESSAGE]);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

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
        body: JSON.stringify({ message: userMessage.content, history: messages }),
      });

      const data = await res.json();
      const fullText: string = data.answer ?? "";

      if (!fullText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Şu an cevap veremedim, tekrar dener misin?" },
        ]);
        setLoading(false);
        return;
      }

      let index = 0;
      const speed = fullText.length < 200 ? 25 : fullText.length < 600 ? 15 : 8;

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
    } catch {
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
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size={42} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-white text-base leading-tight">
                Orhan Karaköprü
              </h1>
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                aktif
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">AI Product Manager · Dijital İkiz</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Social links */}
          <div className="hidden sm:flex items-center gap-3 text-gray-500 text-xs">
            <a
              href="https://www.linkedin.com/in/orhankarakopru"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              LinkedIn
            </a>
            <span>·</span>
            <a
              href="https://orhankarakopru.com.tr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              Website
            </a>
          </div>

          {isConversationStarted && (
            <button
              onClick={clearHistory}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Temizle
            </button>
          )}
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2.5 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {msg.role === "assistant" && <Avatar size={30} />}

            <div
              className={`max-w-xl px-4 py-3 rounded-2xl leading-relaxed text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-gray-900 border border-gray-800 text-gray-100 rounded-bl-sm"
              }`}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Typing */}
        {typingText && (
          <div className="flex items-end gap-2.5">
            <Avatar size={30} />
            <div className="max-w-xl px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-900 border border-gray-800 text-gray-100 leading-relaxed text-sm">
              <ReactMarkdown>{typingText}</ReactMarkdown>
              <span className="animate-pulse text-indigo-400">▍</span>
            </div>
          </div>
        )}

        {/* Thinking */}
        {loading && !typingText && (
          <div className="flex items-end gap-2.5">
            <Avatar size={30} />
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-900 border border-gray-800 text-gray-500 text-sm flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {!isConversationStarted && !loading && (
        <div className="px-4 sm:px-6 pb-3">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs text-gray-400 border border-gray-700 hover:border-indigo-500 hover:text-indigo-300 px-3 py-2 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="px-4 sm:px-6 py-4 border-t border-gray-800">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            rows={2}
            className="flex-1 resize-none rounded-xl bg-gray-900 border border-gray-700 focus:border-indigo-500 p-3 text-sm focus:outline-none transition-colors"
            placeholder="Bir şey sor..."
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
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium px-5 py-3 rounded-xl text-sm transition-colors"
          >
            Gönder
          </button>
        </div>
        <p className="text-center text-gray-600 text-xs mt-3">
          Bu bir AI simülasyonu — gerçek Orhan ile konuşmuyorsunuz.
        </p>
      </footer>

    </main>
  );
}
