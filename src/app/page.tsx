"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
  showCTA?: boolean;
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
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    stopAudio();
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingIndex(null);
    setLoadingAudio(null);
  }

  async function playMessage(text: string, index: number) {
    // Zaten çalıyorsa durdur
    if (playingIndex === index) {
      stopAudio();
      return;
    }

    stopAudio();
    setLoadingAudio(index);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("TTS API error:", res.status, errText);
        throw new Error(`TTS failed: ${res.status}`);
      }

      const blob = await res.blob();
      console.log("TTS blob size:", blob.size, "type:", blob.type);

      if (blob.size === 0) throw new Error("Empty audio blob");

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => { setPlayingIndex(index); setLoadingAudio(null); };
      audio.onended = () => { setPlayingIndex(null); URL.revokeObjectURL(url); };
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setPlayingIndex(null);
        setLoadingAudio(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error("playMessage error:", err);
      setPlayingIndex(null);
      setLoadingAudio(null);
    }
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
      const showCTA: boolean = !!data.showCTA;

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
          setMessages((prev) => [...prev, { role: "assistant", content: fullText, showCTA }]);
          setTypingText("");
          setLoading(false);
        }
      }, speed);

      setTimeout(() => {
        clearInterval(interval);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev;
          return [...prev, { role: "assistant", content: fullText, showCTA }];
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

                {/* CTA kartı — yüksek değerli konularda */}
                {msg.role === "assistant" && msg.showCTA && (
                  <div className="mt-2 w-full p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                    <p className="text-[11px] text-white/50 mb-2">Devam etmek ister misin?</p>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href="https://www.linkedin.com/in/orhankarakopru"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        LinkedIn&apos;den yaz
                      </a>
                      <a
                        href="mailto:o.karakopru@gmail.com"
                        className="text-xs border border-white/15 hover:border-indigo-500/50 hover:text-indigo-300 text-white/60 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        E-posta gönder
                      </a>
                    </div>
                  </div>
                )}

                {/* Ses butonu — sadece asistan mesajları */}
                {msg.role === "assistant" && (
                  <button
                    onClick={() => playMessage(msg.content, i)}
                    title={playingIndex === i ? "Durdur" : "Sesli dinle"}
                    className={`mt-1.5 flex items-center gap-1 text-[11px] transition-all px-2 py-0.5 rounded-full
                      ${playingIndex === i
                        ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/25"
                        : "text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100"
                      }
                      ${loadingAudio === i ? "text-white/40 opacity-100" : ""}
                    `}
                  >
                    {loadingAudio === i ? (
                      <>
                        <span className="w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                        <span>yükleniyor</span>
                      </>
                    ) : playingIndex === i ? (
                      <>
                        <span className="flex gap-px items-end h-3">
                          {[1, 2, 3].map((b) => (
                            <span key={b} className="w-0.5 bg-indigo-400 rounded-full animate-bounce"
                              style={{ height: `${[8, 12, 6][b-1]}px`, animationDelay: `${(b-1) * 100}ms` }} />
                          ))}
                        </span>
                        <span>durdur</span>
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M2 2l6 3-6 3V2z" />
                        </svg>
                        <span>dinle</span>
                      </>
                    )}
                  </button>
                )}
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
