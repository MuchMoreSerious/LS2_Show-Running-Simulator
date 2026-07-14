import { DocumentCategory, EventType, ProcessingStatus, RiskCategory, SimulationPhase } from "@/types/models";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  corporate_press_conference: "기업 프레스컨퍼런스",
  new_vehicle_launch: "신차 발표회",
  exhibition_booth_showcase: "전시 부스 쇼케이스",
  brand_event: "브랜드 이벤트",
  stage_conference: "무대 컨퍼런스",
};

export const DOC_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  manual: "운영 매뉴얼",
  full_timetable: "전체 타임테이블",
  cue_sheet: "큐시트",
  staffing: "인력 배치표",
  equipment_list: "장비 리스트",
  content_list: "영상 및 콘텐츠 리스트",
  readiness_sheet: "준비 현황표",
  floor_plan: "장소 도면 / 공간 정보",
  past_report: "과거 결과보고서",
  incident_log: "사고 및 이슈 기록",
};

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  uploaded: "업로드 완료",
  extracting: "텍스트 추출 중",
  analyzing: "구조 분석 중",
  needs_review: "검토 필요",
  completed: "처리 완료",
  error: "오류",
};

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  schedule: "일정", staffing: "인력", equipment: "장비", content: "콘텐츠",
  presenter: "출연자", vehicle: "차량", robot: "로봇", safety: "안전",
  client: "클라이언트", audience: "관객", media: "미디어", weather: "날씨",
  venue: "장소", comms: "통신", power: "전력",
};

export const PHASE_LABELS_KO: Record<SimulationPhase, string> = {
  load_in: "설치 및 세팅",
  tech_rehearsal: "기술 리허설",
  full_rehearsal: "전체 리허설",
  pre_show: "행사 직전",
  show: "본 행사",
  load_out: "철수",
};

export const DIFFICULTY_LABELS = {
  easy: "쉬움", normal: "보통", hard: "어려움", live_ops: "실제 현장 수준",
} as const;

export const FREQUENCY_LABELS = {
  low: "낮음", normal: "보통", high: "높음",
} as const;

export const CONFIDENCE_LABELS = {
  document_stated: "문서 명시 (높은 신뢰도)",
  cross_document_inference: "문서 간 추론 (중간 신뢰도)",
  ai_estimate: "AI 추정 (낮은 신뢰도)",
} as const;

export const EVIDENCE_LABELS = {
  manual: "현재 운영 매뉴얼 근거",
  readiness: "준비 현황 근거",
  historical_case: "과거 사례 근거",
  general_knowledge: "일반 행사 운영 지식",
  ai_estimate: "AI 추정",
} as const;
