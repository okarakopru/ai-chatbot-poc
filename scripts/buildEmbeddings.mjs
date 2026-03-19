/**
 * Chunk'ları OpenAI text-embedding-3-small ile embed eder.
 * Sonucu src/data/orhan.embeddings.json dosyasına yazar.
 *
 * Kullanım:
 *   node src/scripts/buildEmbeddings.mjs
 *
 * Chunk eklendiğinde tekrar çalıştır ve commit et.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHUNKS_PATH = join(__dirname, "../data/orhan.chunks.json");
const OUTPUT_PATH = join(__dirname, "../data/orhan.embeddings.json");
const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error("OPENAI_API_KEY env variable missing");
  process.exit(1);
}

const chunks = JSON.parse(readFileSync(CHUNKS_PATH, "utf-8"));

async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

console.log(`Embedding ${chunks.length} chunks...`);

const embeddings = [];

for (const chunk of chunks) {
  const text = `${chunk.topic}\n${chunk.keywords.join(", ")}\n${chunk.content}`;
  const vector = await embed(text);
  embeddings.push({ id: chunk.id, vector });
  console.log(`✓ ${chunk.id}`);
}

writeFileSync(OUTPUT_PATH, JSON.stringify(embeddings, null, 2));
console.log(`\nSaved ${embeddings.length} embeddings → ${OUTPUT_PATH}`);
