import chunks from "../data/orhan.chunks.json";
import embeddings from "../data/orhan.embeddings.json";

type Chunk = {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
};

type EmbeddingEntry = {
  id: string;
  vector: number[];
};

// Cosine similarity hesapla
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Sorguyu OpenAI ile embed et
async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// Keyword tabanlı fallback (embedding başarısız olursa)
function keywordSearch(query: string, topK: number): Chunk[] {
  const q = query.toLowerCase();
  const queryTokens = q.split(/\s+/).filter((t) => t.length > 2);

  const scored = (chunks as Chunk[]).map((chunk) => {
    let score = 0;
    for (const kw of chunk.keywords) {
      if (q.includes(kw)) score += 3;
      for (const token of queryTokens) {
        if (kw.includes(token) || token.includes(kw)) score += 1;
      }
    }
    const topicTokens = chunk.topic.split(/\s+/);
    for (const tt of topicTokens) {
      if (q.includes(tt)) score += 2;
    }
    const contentLower = chunk.content.toLowerCase();
    for (const token of queryTokens) {
      if (contentLower.includes(token)) score += 0.5;
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

// Ana retrieval fonksiyonu — önce semantic, fallback keyword
export async function retrieveChunks(query: string, topK = 5): Promise<Chunk[]> {
  const queryVector = await embedQuery(query);

  if (queryVector) {
    // Semantic search — cosine similarity
    const embeddingMap = new Map<string, number[]>(
      (embeddings as EmbeddingEntry[]).map((e) => [e.id, e.vector])
    );

    const scored = (chunks as Chunk[]).map((chunk) => {
      const vec = embeddingMap.get(chunk.id);
      const score = vec ? cosineSimilarity(queryVector, vec) : 0;
      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.chunk);
  }

  // Fallback: keyword search
  return keywordSearch(query, topK);
}

// Chunk'ları sistem prompt'a inject edilecek string'e çevir
export function formatChunksForPrompt(chunks: Chunk[]): string {
  if (chunks.length === 0) return "";
  return chunks.map((c) => `### ${c.topic}\n${c.content}`).join("\n\n");
}
