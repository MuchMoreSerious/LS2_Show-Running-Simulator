import { AIProvider } from "./provider";
import { MockAIProvider } from "./mock-provider";
import { ClaudeAIProvider } from "./claude-provider";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const forced = process.env.AI_PROVIDER;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (forced === "mock") {
    cached = new MockAIProvider();
  } else if (forced === "claude" || (!forced || forced === "auto") && apiKey) {
    cached = apiKey
      ? new ClaudeAIProvider(apiKey, process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6")
      : new MockAIProvider();
  } else {
    cached = new MockAIProvider();
  }
  return cached;
}

export type { AIProvider } from "./provider";
