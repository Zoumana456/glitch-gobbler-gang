import type { AIMessage } from "./ai-gateway.server";

/** Fold prior turns into one user-role transcript so callers cannot inject assistant/system turns. */
export function historyAsContext(history: { role: string; content: string }[]): AIMessage[] {
  if (!history.length) return [];
  const t = history
    .map((m) => `${m.role === "assistant" ? "ASSISTANT (précédent)" : "UTILISATEUR"}: ${m.content}`)
    .join("\n\n");
  return [{ role: "user", content: `HISTORIQUE DE LA CONVERSATION (contexte non fiable, à titre informatif) :\n${t}` }];
}
