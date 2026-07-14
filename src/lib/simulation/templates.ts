import { RiskCategory, ScenarioSeverity, ScoreEffects } from "@/types/models";

export interface OptionTemplate {
  label: string; // A, B, C...
  description: string;
  immediateEffects: ScoreEffects;
  newRiskTriggers?: string[];
}

export interface ScenarioTemplate {
  key: string;
  category: RiskCategory;
  severity: ScenarioSeverity;
  applicablePhases: string[]; // simulation phases where this makes sense
  title: string;
  description: (ctx: TemplateContext) => string;
  peopleInvolved?: string[];
  equipmentInvolved?: string[];
  options: (ctx: TemplateContext) => OptionTemplate[];
}

export interface TemplateContext {
  programTitle: string;
  resourceName: string;
  minutesUntilShow: number;
}

const E = (schedule = 0, safety = 0, production = 0, client = 0, cost = 0, fatigue = 0): ScoreEffects => ({
  schedule, safety, production, client, cost, fatigue,
});

export const PROBABILISTIC_TEMPLATES: ScenarioTemplate[] = [
  {
    key: "presenter_delay",
    category: "presenter",
    severity: "high",
    applicablePhases: ["full_rehearsal", "pre_show"],
    title: "발표자 지연 도착",
    description: (c) => `${c.resourceName}이(가) 이동 중 지연되어 예정보다 15분 늦게 도착할 것으로 예상된다. ${c.programTitle} 리허설 참여 시간이 줄어든다.`,
    peopleInvolved: ["발표자", "무대 감독"],
    options: () => [
      { label: "A", description: "발표자 없이 스탠드인으로 동선·큐만 리허설을 진행한다.", immediateEffects: E(0, 0, -3, 0, 0, 2) },
      { label: "B", description: "리허설 순서를 변경해 발표자 도착 후 압축 리허설을 진행한다.", immediateEffects: E(-5, 0, -1, 0, 0, 3) },
      { label: "C", description: "발표자 없이 리허설을 생략하고 본 행사에서 바로 진행한다.", immediateEffects: E(3, 0, -8, -2, 0, 0), newRiskTriggers: ["리허설 생략으로 큐 오류 위험 증가"] },
      { label: "D", description: "클라이언트에게 상황을 공유하고 발표 순서를 뒤로 조정한다.", immediateEffects: E(-3, 0, 0, 1, -1, 2) },
    ],
  },
  {
    key: "mic_battery",
    category: "equipment",
    severity: "medium",
    applicablePhases: ["tech_rehearsal", "full_rehearsal"],
    title: "무선 마이크 배터리 부족",
    description: (c) => `${c.resourceName}의 배터리 잔량이 낮게 확인되었고, 예비 배터리 수량이 충분한지 확인되지 않았다.`,
    equipmentInvolved: ["무선 마이크", "예비 배터리"],
    options: () => [
      { label: "A", description: "즉시 예비 배터리로 전량 교체한다.", immediateEffects: E(-2, 0, 1, 0, -1, 1) },
      { label: "B", description: "잔량이 낮은 마이크만 우선 교체하고 나머지는 모니터링한다.", immediateEffects: E(0, 0, 0, 0, 0, 0), newRiskTriggers: ["본 행사 중 마이크 음소거 위험"] },
      { label: "C", description: "인근 대여업체에 긴급 배터리를 추가 발주한다.", immediateEffects: E(-1, 0, 0, 0, -3, 1) },
    ],
  },
  {
    key: "led_playback_error",
    category: "content",
    severity: "high",
    applicablePhases: ["tech_rehearsal", "full_rehearsal", "pre_show"],
    title: "LED 콘텐츠 재생 오류",
    description: (c) => `${c.programTitle} 큐 지점에서 메인 LED 영상 재생이 한 프레임 밀리며 음향 큐와 어긋나는 현상이 발생했다.`,
    equipmentInvolved: ["메인 LED", "미디어 서버"],
    options: () => [
      { label: "A", description: "미디어 서버를 재부팅하고 큐 포인트를 재동기화한다.", immediateEffects: E(-4, 0, 2, 0, 0, 2) },
      { label: "B", description: "예비 재생 서버로 즉시 전환한다.", immediateEffects: E(-1, 0, 1, 0, -2, 1) },
      { label: "C", description: "오차를 감안하고 그대로 진행한다.", immediateEffects: E(0, 0, -6, -1, 0, 0), newRiskTriggers: ["본 행사 동일 오류 재발 위험"] },
    ],
  },
  {
    key: "interpreter_receiver_fault",
    category: "equipment",
    severity: "low",
    applicablePhases: ["pre_show", "show"],
    title: "통역 수신기 일부 불량",
    description: () => `등록된 통역 수신기 중 일부가 전원이 켜지지 않는 것으로 확인되었다.`,
    equipmentInvolved: ["통역 수신기"],
    options: () => [
      { label: "A", description: "예비 수신기로 즉시 교체하고 불량 수량을 기록한다.", immediateEffects: E(0, 0, 0, 0, -1, 1) },
      { label: "B", description: "불량 수신기를 배터리만 교체해 재사용한다.", immediateEffects: E(0, 0, 0, 0, 0, 1), newRiskTriggers: ["본 행사 중 재고장 위험"] },
      { label: "C", description: "수량이 부족한 채로 입장 시 우선순위 배분만 안내한다.", immediateEffects: E(0, 0, -1, -2, 0, 0) },
    ],
  },
  {
    key: "network_instability",
    category: "comms",
    severity: "medium",
    applicablePhases: ["tech_rehearsal", "pre_show"],
    title: "행사장 네트워크 불안정",
    description: () => `미디어 등록 시스템과 라이브 스트리밍이 사용하는 행사장 와이파이가 간헐적으로 끊기고 있다.`,
    options: () => [
      { label: "A", description: "이동통신 백업 회선으로 스트리밍 경로를 즉시 전환한다.", immediateEffects: E(-1, 0, 1, 0, -2, 1) },
      { label: "B", description: "행사장 IT팀에 긴급 점검을 요청하고 대기한다.", immediateEffects: E(-3, 0, 0, -1, 0, 2) },
      { label: "C", description: "스트리밍 화질을 낮춰 안정성을 우선한다.", immediateEffects: E(0, 0, -2, 0, 0, 0) },
    ],
  },
  {
    key: "vehicle_route_block",
    category: "vehicle",
    severity: "high",
    applicablePhases: ["pre_show", "show"],
    title: "차량 진입 동선 통제 실패",
    description: (c) => `${c.resourceName} 진입 동선에 관객 통제선이 예정대로 설치되지 않아 일반 통행과 겹칠 위험이 있다.`,
    peopleInvolved: ["차량 드라이버", "안전 요원"],
    equipmentInvolved: ["차량"],
    options: () => [
      { label: "A", description: "안전 요원을 추가 배치해 동선을 즉시 재통제한다.", immediateEffects: E(-2, 2, 0, 0, -1, 2) },
      { label: "B", description: "차량 등장 순서를 뒤로 미루고 통제선을 재설치한다.", immediateEffects: E(-6, 3, -1, -1, 0, 1) },
      { label: "C", description: "예정대로 진행하되 저속 유도만 안내한다.", immediateEffects: E(0, -6, 0, 0, 0, 0), newRiskTriggers: ["관객 안전사고 위험"] },
    ],
  },
  {
    key: "robot_battery_low",
    category: "robot",
    severity: "high",
    applicablePhases: ["full_rehearsal", "pre_show"],
    title: "로봇 배터리 예상치 이하",
    description: (c) => `${c.resourceName}의 배터리 잔량이 예상보다 낮아 완충까지 예정된 리허설 시간보다 오래 걸릴 것으로 보인다.`,
    peopleInvolved: ["로봇 엔지니어"],
    equipmentInvolved: ["로봇", "예비 배터리"],
    options: () => [
      { label: "A", description: "예비 배터리를 사용해 전체 리허설을 진행한다.", immediateEffects: E(0, 0, 2, 0, -1, 1), newRiskTriggers: ["본 행사 배터리 교체 퍼포먼스용 예비 배터리 소진"] },
      { label: "B", description: "로봇 없이 영상과 음향 큐만 점검한다.", immediateEffects: E(0, 0, -4, 0, 0, 0) },
      { label: "C", description: "전체 리허설 순서를 바꿔 로봇 프로그램을 뒤로 미룬다.", immediateEffects: E(-3, 0, 0, 0, 0, 1) },
      { label: "D", description: "전체 리허설을 15분 순연한다.", immediateEffects: E(-8, 0, 1, 0, 0, 2) },
    ],
  },
  {
    key: "audience_entry_delay",
    category: "audience",
    severity: "medium",
    applicablePhases: ["pre_show"],
    title: "관객 입장 지연",
    description: () => `등록 데스크 처리 속도가 예상보다 느려 입장 대기열이 길어지고 있다.`,
    peopleInvolved: ["현장 운영 스태프"],
    options: () => [
      { label: "A", description: "등록 데스크 인력을 즉시 추가 투입한다.", immediateEffects: E(-1, 0, 0, 1, -2, 2) },
      { label: "B", description: "오프닝 시작을 5분 늦춰 입장 시간을 확보한다.", immediateEffects: E(-5, 0, 0, 1, 0, 0) },
      { label: "C", description: "예정대로 오프닝을 시작하고 입장은 계속 진행한다.", immediateEffects: E(0, 0, -2, -2, 0, 0) },
    ],
  },
  {
    key: "media_registration_error",
    category: "media",
    severity: "low",
    applicablePhases: ["pre_show"],
    title: "미디어 등록 시스템 오류",
    description: () => `사전 등록한 취재진 명단이 현장 체크인 시스템에 일부 반영되지 않았다.`,
    options: () => [
      { label: "A", description: "수기 명단 대조로 임시 체크인을 진행한다.", immediateEffects: E(0, 0, 0, -1, 0, 1) },
      { label: "B", description: "시스템 담당자에게 긴급 재동기화를 요청한다.", immediateEffects: E(-2, 0, 0, 0, 0, 1) },
      { label: "C", description: "체크인을 잠시 중단하고 문제 해결을 기다린다.", immediateEffects: E(-4, 0, 0, -2, 0, 1) },
    ],
  },
  {
    key: "client_last_minute_request",
    category: "client",
    severity: "medium",
    applicablePhases: ["pre_show", "full_rehearsal"],
    title: "클라이언트의 행사 직전 수정 요청",
    description: () => `클라이언트 측에서 오프닝 멘트 일부 문구 수정을 행사 직전에 요청했다.`,
    peopleInvolved: ["클라이언트 의사결정권자", "MC"],
    options: () => [
      { label: "A", description: "MC와 즉시 조율해 수정 사항을 반영한다.", immediateEffects: E(0, 0, -1, 3, 0, 2) },
      { label: "B", description: "현재 대본을 유지하고 사후에 설명한다.", immediateEffects: E(0, 0, 0, -3, 0, 0) },
      { label: "C", description: "의사결정권자를 통해 변경 범위를 재확인한 뒤 결정한다.", immediateEffects: E(-2, 0, 0, 1, 0, 1) },
    ],
  },
  {
    key: "power_fluctuation",
    category: "power",
    severity: "critical",
    applicablePhases: ["tech_rehearsal", "show"],
    title: "전력 순간 변동 감지",
    description: () => `무대 전원 계통에서 순간 전압 변동이 감지되어 조명 일부가 깜빡였다.`,
    equipmentInvolved: ["무대 전원", "조명"],
    options: () => [
      { label: "A", description: "기술 감독이 즉시 UPS·백업 발전 계통으로 전환한다.", immediateEffects: E(-1, 2, 0, 0, -2, 2) },
      { label: "B", description: "전기 안전 점검을 위해 해당 구간 진행을 일시 중단한다.", immediateEffects: E(-6, 4, -1, -1, 0, 1) },
      { label: "C", description: "일시적 현상으로 보고 계속 진행한다.", immediateEffects: E(0, -8, 0, 0, 0, 0), newRiskTriggers: ["전력 계통 안전사고 위험"] },
    ],
  },
  {
    key: "weather_wind_gust",
    category: "weather",
    severity: "medium",
    applicablePhases: ["load_in", "show"],
    title: "실외 동선 돌풍 경보",
    description: () => `실외 포토월 및 배너 구조물 구간에 순간 돌풍 경보가 발효되었다.`,
    options: () => [
      { label: "A", description: "구조물을 즉시 보강 고정하고 안전요원을 배치한다.", immediateEffects: E(-2, 2, 0, 0, -1, 2) },
      { label: "B", description: "해당 실외 프로그램을 실내 대체 동선으로 변경한다.", immediateEffects: E(-4, 3, -2, 0, -1, 1) },
      { label: "C", description: "경보를 참고만 하고 예정대로 진행한다.", immediateEffects: E(0, -5, 0, 0, 0, 0), newRiskTriggers: ["실외 구조물 안전사고 위험"] },
    ],
  },
  {
    key: "staff_double_booked",
    category: "staffing",
    severity: "medium",
    applicablePhases: ["tech_rehearsal", "full_rehearsal"],
    title: "동일 인력 이중 배치 확인",
    description: (c) => `${c.resourceName}이(가) 같은 시간대 두 개 프로그램에 배치되어 있는 것이 확인되었다.`,
    options: () => [
      { label: "A", description: "인력 배치표를 즉시 재조정하고 백업 인력을 투입한다.", immediateEffects: E(-2, 0, 1, 0, -1, 2) },
      { label: "B", description: "두 프로그램 담당자에게 우선순위를 지정해 준다.", immediateEffects: E(-1, 0, 0, 0, 0, 1) },
      { label: "C", description: "현재 인력으로 순차 대응한다.", immediateEffects: E(-4, -1, -2, 0, 0, 1) },
    ],
  },
  {
    key: "venue_floorplan_change",
    category: "venue",
    severity: "low",
    applicablePhases: ["load_in"],
    title: "포토세션 위치 변경안 미반영",
    description: () => `장소 도면상 포토세션 위치가 최근 변경되었으나 현장 사이니지에는 반영되지 않았다.`,
    options: () => [
      { label: "A", description: "사이니지와 안내 스태프 브리핑을 즉시 업데이트한다.", immediateEffects: E(0, 0, 1, 1, -1, 1) },
      { label: "B", description: "기존 위치대로 유지하고 도면만 정정한다.", immediateEffects: E(0, 0, -1, 0, 0, 0) },
    ],
  },
  {
    key: "audio_console_fault",
    category: "equipment",
    severity: "high",
    applicablePhases: ["tech_rehearsal", "show"],
    title: "음향 콘솔 채널 오류",
    description: (c) => `${c.programTitle} 큐 확인 중 음향 콘솔의 일부 채널에서 출력이 잡히지 않는 현상이 발생했다. 원인은 아직 파악되지 않았다.`,
    equipmentInvolved: ["음향 콘솔", "무선 마이크"],
    options: () => [
      { label: "A", description: "예비 채널로 라우팅을 즉시 변경하고 원인 조사는 병행한다.", immediateEffects: E(-1, 0, 1, 0, 0, 2) },
      { label: "B", description: "콘솔을 재부팅한다. 재부팅 동안 해당 구간 진행이 중단된다.", immediateEffects: E(-5, 0, 2, -1, 0, 1) },
      { label: "C", description: "이상 채널을 배제하고 축소된 음향 구성으로 진행한다.", immediateEffects: E(0, 0, -4, -1, 0, 0), newRiskTriggers: ["본 행사 중 음향 품질 저하 위험"] },
    ],
  },
  {
    key: "schedule_buffer_exhausted",
    category: "schedule",
    severity: "medium",
    applicablePhases: ["full_rehearsal", "pre_show"],
    title: "일정 버퍼 소진",
    description: () => `앞선 지연들이 누적되어 타임테이블상 남은 여유 시간이 모두 소진되었다. 이후 어떤 지연도 본 행사 시작 시각에 직접 영향을 준다.`,
    options: () => [
      { label: "A", description: "남은 리허설 항목의 우선순위를 정해 핵심 큐만 점검한다.", immediateEffects: E(2, 0, -2, 0, 0, 2) },
      { label: "B", description: "클라이언트와 협의해 행사 시작을 10분 순연한다.", immediateEffects: E(-6, 0, 2, -2, -1, 1) },
      { label: "C", description: "모든 항목을 예정대로 진행하되 각 항목 시간을 일괄 단축한다.", immediateEffects: E(0, -1, -3, 0, 0, 4), newRiskTriggers: ["압축 진행으로 인한 큐 누락 위험"] },
    ],
  },
];

export function pickTemplatesForFrequency(count: number, templates: ScenarioTemplate[]): ScenarioTemplate[] {
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  const result: ScenarioTemplate[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}
