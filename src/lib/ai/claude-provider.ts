import { AIProvider, DocumentStructureResult, HistoricalCaseExtractionItem } from "./provider";
import { DOCUMENT_STRUCTURE_PROMPT, HISTORICAL_CASE_PROMPT } from "./prompts";

const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Claude API 기반 실제 Provider.
 * ANTHROPIC_API_KEY 환경변수가 설정된 경우에만 선택된다 (src/lib/ai/index.ts 참고).
 */
export class ClaudeAIProvider implements AIProvider {
  readonly name = "claude" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async callJSON(systemPrompt: string, userContent: string): Promise<unknown> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API 오류 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const text = (data.content ?? []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("\n");
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }

  async structureDocument(text: string, category: string, filename: string): Promise<DocumentStructureResult> {
    const userContent = `문서 카테고리: ${category}\n파일명: ${filename}\n\n--- 문서 내용 ---\n${text.slice(0, 12000)}`;
    const result = await this.callJSON(DOCUMENT_STRUCTURE_PROMPT, userContent);
    return result as DocumentStructureResult;
  }

  async extractHistoricalCases(text: string, filename: string): Promise<HistoricalCaseExtractionItem[]> {
    const userContent = `파일명: ${filename}\n\n--- 문서 내용 ---\n${text.slice(0, 12000)}`;
    const result = await this.callJSON(HISTORICAL_CASE_PROMPT, userContent);
    return Array.isArray(result) ? (result as HistoricalCaseExtractionItem[]) : (result as { cases: HistoricalCaseExtractionItem[] }).cases ?? [];
  }
}
