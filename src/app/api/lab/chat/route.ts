import { NextRequest } from "next/server";
import { getDocuments } from "../../../../lib/labDocuments";
import { chatWithGroq } from "../../../../lib/groq";

export const runtime = "nodejs";

type LabMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function pickModel(
  userMessage: string,
  selected: "auto" | "openai" | "groq"
): "openai" | "groq" {
  const text = userMessage.toLowerCase();

  if (selected === "openai") return "openai";
  if (selected === "groq") return "groq";

  // auto routing (çok basit heuristic)
  if (
    text.includes("code") ||
    text.includes("refactor") ||
    text.includes("debug") ||
    text.includes("hata") ||
    text.includes("stack trace")
  ) return "groq";

  if (
    text.includes("sunum") ||
    text.includes("ppt") ||
    text.includes("slide") ||
    text.includes("deck")
  ) return "openai";

  return "openai";
}

/* -------------------- RAG helpers (advanced naive) -------------------- */

// TR/EN stopwords (küçük set, işe yarıyor)
const STOP = new Set([
  "ve","veya","ama","fakat","ancak","ile","için","gibi","kadar","daha","en","çok",
  "bir","bu","şu","o","da","de","ki","mi","mı","mu","mü","ne","neden","nasıl",
  "the","a","an","and","or","but","to","for","in","on","of","is","are","was","were",
  "it","this","that","with","as","by","from","at","be"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !STOP.has(t));
}

type Chunk = {
  docName: string;
  chunkId: string;
  text: string;
};

function chunkText(docName: string, text: string): Chunk[] {
  // Paragraflara böl, sonra max uzunlukla birleştir
  const paras = text
    .split(/\n{2,}/g)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  const MAX = 1200;      // karakter bazlı (token yerine pratik)
  const OVERLAP = 200;

  let buf = "";
  let idx = 0;

  for (const p of paras) {
    if ((buf + "\n\n" + p).length <= MAX) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      if (buf) {
        chunks.push({ docName, chunkId: `${docName}#${idx++}`, text: buf });
        // overlap: sondan parça al
        buf = buf.slice(Math.max(0, buf.length - OVERLAP));
      }
      // paragraf çok büyükse parça parça kes
      if (p.length > MAX) {
        let start = 0;
        while (start < p.length) {
          const part = p.slice(start, start + MAX);
          chunks.push({ docName, chunkId: `${docName}#${idx++}`, text: part });
          start += (MAX - OVERLAP);
        }
        buf = "";
      } else {
        buf = p;
      }
    }
  }

  if (buf) {
    chunks.push({ docName, chunkId: `${docName}#${idx++}`, text: buf });
  }

  return chunks;
}

/**
 * Advanced-naive scoring:
 * - Token overlap (TF)
 * - Small bonus for exact phrase matches
 * - Length normalization (çok uzun chunk “şişmesin”)
 */
function scoreChunk(queryTokens: string[], chunkText: string, rawQuery: string): number {
  if (queryTokens.length === 0) return 0;

  const text = chunkText.toLowerCase();
  const chunkTokens = tokenize(text);

  if (chunkTokens.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const t of chunkTokens) freq.set(t, (freq.get(t) || 0) + 1);

  let score = 0;
  for (const qt of queryTokens) {
    const f = freq.get(qt) || 0;
    if (f > 0) score += 1 + Math.log(1 + f); // tf-ish
  }

  // phrase bonus (ham query içinde 2+ kelimelik parça varsa)
  const q = rawQuery.toLowerCase().trim();
  if (q.length >= 8 && text.includes(q)) score += 5;

  // normalize (çok uzun chunk avantajlı olmasın)
  const norm = Math.sqrt(chunkTokens.length);
  return score / norm;
}

function buildContext(rawQuery: string) {
  const docs = getDocuments();

  // doküman yoksa context yok
  if (!docs || docs.length === 0) {
    return { context: "", usedDocs: [] as string[] };
  }

  // içerik boş olanları ele
  const usable = docs
    .filter(d => (d.content || "").trim().length > 0)
    .slice(-20); // en fazla son 20 doküman (memory büyümesin)

  if (usable.length === 0) {
    return { context: "", usedDocs: [] as string[] };
  }

  const queryTokens = tokenize(rawQuery);
  const allChunks: Chunk[] = [];
  for (const d of usable) {
    allChunks.push(...chunkText(d.name, d.content));
  }

  // skorla
  const scored = allChunks
    .map(c => ({
      c,
      s: scoreChunk(queryTokens, c.text, rawQuery)
    }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);

  // context budget (token yerine char budget)
  const CONTEXT_MAX_CHARS = 4500;
  const TOP_K = 6;

  let ctx = "";
  const used = new Set<string>();

  for (const item of scored.slice(0, TOP_K)) {
    const piece =
      `\n[Document: ${item.c.docName}]\n${item.c.text}\n`;

    if ((ctx + piece).length > CONTEXT_MAX_CHARS) break;
    ctx += piece;
    used.add(item.c.docName);
  }

  return {
    context: ctx.trim(),
    usedDocs: Array.from(used)
  };
}

/* -------------------- handler -------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      model = "auto",
      temperature = 0.7,
      systemPrompt = ""
    } = body as {
      message: string;
      history?: LabMessage[];
      model?: "auto" | "openai" | "groq";
      temperature?: number;
      systemPrompt?: string;
    };

    const picked = pickModel(message, model);

    // RAG context
    const { context, usedDocs } = buildContext(message);

    // System messages: user supplied + RAG instruction
    const systemMessages: LabMessage[] = [];

    if (systemPrompt && systemPrompt.trim()) {
      systemMessages.push({ role: "system", content: systemPrompt });
    }

    // RAG instruction: doküman varsa ekle
    if (context) {
      systemMessages.push({
        role: "system",
        content:
          `You have access to the user's uploaded documents below. ` +
          `Answer the user's question using ONLY the provided document context when relevant. ` +
          `If the documents do not contain the answer, say you cannot find it in the uploaded documents.\n\n` +
          `DOCUMENT CONTEXT:\n${context}`
      });
    } else {
      systemMessages.push({
        role: "system",
        content:
          `No uploaded document context is available. Answer normally.`
      });
    }

    const messages: LabMessage[] = [
      ...systemMessages,
      ...history,
      { role: "user", content: message }
    ];

    let answer = "";

    if (picked === "groq") {
      // Groq hata verirse OpenAI fallback
      try {
        answer = await chatWithGroq(messages, temperature);
      } catch (err) {
        console.error("GROQ FAILED, FALLBACK TO OPENAI", err);
        answer = await chatWithOpenAI(messages, temperature);
      }
    } else {
      answer = await chatWithOpenAI(messages, temperature);
    }

    return Response.json({
      answer,
      usedModel: picked,
      usedDocs
    });
  } catch (err) {
    console.error("LAB CHAT ERROR:", err);
    return Response.json({ answer: "Bir hata oluştu." }, { status: 500 });
  }
}

async function chatWithOpenAI(messages: LabMessage[], temperature: number) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      max_tokens: 700,
      messages
    })
  });

  const data = await res.json();

  const content = data?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    // OpenAI bazen boş dönebilir; net fallback
    return "Bu soruya şu an yanıt üretemedim. Doküman içeriğini daha spesifik soruyla tekrar dener misin?";
  }

  return content;
}
