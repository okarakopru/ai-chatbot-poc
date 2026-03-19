export type ModelKey = "qwen3" | "glm4" | "kimi_k2" | "deepseek_v3";

export const MODELS: Record<ModelKey, { id: string; label: string }> = {
  qwen3: { id: "qwen/qwen3-235b-a22b", label: "Qwen3 235B" },
  glm4: { id: "zhipu/glm-4", label: "GLM-4" },
  kimi_k2: { id: "moonshotai/kimi-k2", label: "Kimi K2 Thinking" },
  deepseek_v3: { id: "deepseek/deepseek-v3", label: "DeepSeek V3" }
};

export function pickModel(question: string): ModelKey {
  const q = question.toLowerCase();

  if (q.includes("swift") || q.includes("ios") || q.includes("bug")) {
    return "glm4";
  }

  if (q.includes("plan") || q.includes("adım adım")) {
    return "kimi_k2";
  }

  if (q.includes("özet") || q.includes("translate")) {
    return "deepseek_v3";
  }

  return "qwen3";
}
