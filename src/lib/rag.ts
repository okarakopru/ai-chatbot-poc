import chunks from "../data/orhan.chunks.json";

type Chunk = {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
};

/**
 * Verilen sorguya göre en ilgili chunk'ları döner.
 * Keyword overlap + topic overlap ile skor hesaplar.
 */
export function retrieveChunks(query: string, topK = 5): Chunk[] {
  const q = query.toLowerCase();
  const queryTokens = q.split(/\s+/).filter((t) => t.length > 2);

  const scored = (chunks as Chunk[]).map((chunk) => {
    let score = 0;

    // Keyword eşleşmesi
    for (const kw of chunk.keywords) {
      if (q.includes(kw)) score += 3;
      for (const token of queryTokens) {
        if (kw.includes(token) || token.includes(kw)) score += 1;
      }
    }

    // Topic eşleşmesi
    const topicTokens = chunk.topic.split(/\s+/);
    for (const tt of topicTokens) {
      if (q.includes(tt)) score += 2;
    }

    // Content içinde tam eşleşme
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

/**
 * Chunk'ları sistem prompt'a inject edilecek string'e çevirir.
 */
export function formatChunksForPrompt(chunks: Chunk[]): string {
  if (chunks.length === 0) return "";
  return chunks.map((c) => `### ${c.topic}\n${c.content}`).join("\n\n");
}
