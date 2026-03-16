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
  const [imgError, setImgError] = useState(false);
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden ring-1 ring-white/10 shrink-0"
    >
      {imgError ? (
        <div
          style={{ width: size, height: size, fontSize: size * 0.35 }}
          className="bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-semibold select-none"
        >
          OK
        </div>
      ) : (
        <img
          src="/avatar.jpg"
          alt="Orhan"
          width={size}
          height={size}
          onError={() => setImgError(true)}
          style={{ width: size, height: size, objectFit: "cover", objectPosition: "center top" }}
        />
      )}
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
      } catch { /* invalid */ }
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
        setMessages((prev) => [...prev, { role: "assistant", content: "Şu an cevap veremedim, tekrar dener misin?" }]);
        setLoading(false);
        return;
      }

      let index = 0;
      const speed = fullText.length < 200 ? 22 : fullText.length < 600 ? 13 : 7;

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
      setMessages((prev) => [...prev, { role: "assistant", content: "Bir hata oluştu, tekrar dener misin?" }]);
      setTypingText("");
      setLoading(false);
    }
  }

  const isConversationStarted = messages.length > 1;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar size={40} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">Orhan Karaköprü</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  aktif
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-0.5">AI Product Manager · Dijital İkiz</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/30">
              <a href="https://www.linkedin.com/in/orhankarakopru" target="_blank" rel="noopener noreferrer"
                className="hover:text-indigo-400 transition-colors">LinkedIn</a>
              <span>·</span>
              <a href="https://orhankarakopru.com.tr" target="_blank" rel="noopener noreferrer"
                className="hover:text-indigo-400 transition-colors">Website</a>
            </div>
            {isConversationStarted && (
              <button onClick={clearHistory}
                className="text-[11px] text-white/25 hover:text-white/60 border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-md transition-all">
                Temizle
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "assistant" && <Avatar size={28} />}

              <div className={`group max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm shadow-lg shadow-indigo-900/30"
                    : "bg-white/5 border border-white/8 text-white/90 rounded-bl-sm"
                }`}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Typing */}
          {typingText && (
            <div className="flex items-end gap-2.5">
              <Avatar size={28} />
              <div className="max-w-[82%] px-4 py-3 rounded-2xl rounded-bl-sm bg-white/5 border border-white/8 text-white/90 text-sm leading-relaxed">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  }}
                >
                  {typingText}
                </ReactMarkdown>
                <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          {/* Thinking */}
          {loading && !typingText && (
            <div className="flex items-end gap-2.5">
              <Avatar size={28} />
              <div className="px-4 py-3.5 rounded-2xl rounded-bl-sm bg-white/5 border border-white/8 flex items-center gap-1">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggested questions */}
      {!isConversationStarted && !loading && (
        <div className="px-4 pb-3">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-xs text-white/40 border border-white/10 hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/5 px-3 py-1.5 rounded-full transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="px-4 pb-4 pt-2 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-indigo-500/40 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/25 focus:outline-none py-1.5 max-h-32"
              placeholder="Bir şey sor..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-all mb-0.5"
            >
              Gönder
            </button>
          </div>
          <p className="text-center text-white/15 text-[10px] mt-2">
            Bu bir AI simülasyonu — gerçek Orhan ile konuşmuyorsunuz.
          </p>
        </div>
      </footer>
    </div>
  );
}
