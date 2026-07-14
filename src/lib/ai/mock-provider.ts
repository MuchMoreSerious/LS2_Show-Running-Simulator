import { AIProvider, DocumentStructureResult, HistoricalCaseExtractionItem } from "./provider";

const TIME_RE = /(\d{1,2}):(\d{2})/g;
const CASE_KEYWORDS = ["문제", "지연", "오류", "사고", "실패", "불량", "누락", "충돌"];
const TRIVIAL_LINE_RE = /^(전반적으로|현장 대응이|클라이언트 반응이)/;

/**
 * 오프라인 결정론적 Mock Provider.
 * 실제 LLM 호출 없이 정규식/휴리스틱으로 문서를 파싱한다.
 * 모든 결과는 evidenceType="ai_estimate", confidence 낮음으로 표시되어야 하며,
 * 호출부(document 처리 파이프라인)에서 이를 강제한다.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const;

  async structureDocument(text: string, category: string, filename: string): Promise<DocumentStructureResult> {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const programs: DocumentStructureResult["programs"] = [];

    for (const line of lines) {
      const times = [...line.matchAll(TIME_RE)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
      if (times.length === 0) continue;
      const title = line.replace(TIME_RE, "").replace(/[-–|~]/g, " ").trim().slice(0, 40) || "미상 프로그램";
      programs.push({
        title,
        programType: guessProgramType(title),
        startTime: times[0],
        endTime: times[1] ?? times[0],
        location: "미상 (문서에 명시 없음)",
        responsiblePersons: [],
        requiredResources: [],
        preconditions: [],
        backupPlans: [],
        decisionMaker: "",
        confidence: times.length >= 2 ? 0.6 : 0.35, // Mock 휴리스틱 상한 — AI 추정 신뢰도
        sources: [filename],
      });
    }

    return {
      eventSummary: {
        eventName: "",
        eventType: "",
        date: "",
        venue: "",
        audienceSize: null,
        objectives: [],
      },
      programs,
      resources: [],
      dependencies: [],
      knownRisks: [],
      missingInformation: [
        `${category} 문서에서 담당자/장비 정보를 정규식 기반으로는 신뢰성 있게 추출하지 못했습니다. (Mock Provider 한계 — Claude API 연결 시 정확도가 향상됩니다.)`,
      ],
      documentConflicts: [],
    };
  }

  async extractHistoricalCases(text: string, filename: string): Promise<HistoricalCaseExtractionItem[]> {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const cases: HistoricalCaseExtractionItem[] = [];

    for (const para of paragraphs) {
      if (TRIVIAL_LINE_RE.test(para)) continue; // 단순 회고 문장은 사례로 과대 해석하지 않는다
      const hasKeyword = CASE_KEYWORDS.some((k) => para.includes(k));
      if (!hasKeyword || para.length < 20) continue;

      cases.push({
        eventType: "",
        eventPhase: "",
        situation: para.slice(0, 200),
        rootCause: "(Mock Provider: 원인 문장을 자동 식별하지 못했습니다 — 검토 필요)",
        immediateResponse: "(Mock Provider: 대응 문장을 자동 식별하지 못했습니다 — 검토 필요)",
        finalOutcome: "(Mock Provider: 결과 문장을 자동 식별하지 못했습니다 — 검토 필요)",
        severity: 3,
        preventable: false,
        preventionActions: [],
        relatedResources: [],
        tags: [],
        sourceReference: filename,
      });
    }
    return cases.slice(0, 10);
  }
}

function guessProgramType(title: string): string {
  const map: [RegExp, string][] = [
    [/입장/, "audience_entry"], [/오프닝/, "opening"], [/mc/i, "mc"],
    [/발표|ceo|임원/i, "keynote"], [/영상/, "video_playback"], [/차량/, "vehicle_reveal"],
    [/로봇|퍼포머/, "performer_reveal"], [/패널/, "panel_talk"], [/질의응답|q&a/i, "qna"],
    [/포토/, "photo_session"], [/인터뷰/, "media_interview"], [/퇴장|종료/, "closing"],
  ];
  for (const [re, type] of map) if (re.test(title)) return type;
  return "general";
}
