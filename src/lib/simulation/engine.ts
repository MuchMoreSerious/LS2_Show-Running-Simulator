import { v4 as uuid } from "uuid";
import {
  Decision, EventProgram, HistoricalCase, Resource, Risk, RiskCategory, Scenario,
  ScenarioOption, ScoreEffects, Simulation, SimulationPhase, SimulationReport,
} from "@/types/models";
import { db } from "@/lib/db/store";
import { applyEffects, calcOverallScore, deriveWeights } from "./scoring";
import { computePhaseWindows, PHASE_LABELS } from "./phases";
import { toMinutes, toHHMM } from "./time";
import { PROBABILISTIC_TEMPLATES, ScenarioTemplate } from "./templates";
import { riskGrade } from "./risk";

const FREQUENCY_COUNT: Record<string, number> = { low: 6, normal: 10, high: 16 };

export interface StartSimulationInput {
  projectId: string;
  difficulty: Simulation["difficulty"];
  phases: SimulationPhase[];
  eventFrequency: Simulation["eventFrequency"];
  includedRiskCategories: RiskCategory[];
}

/** Phase 1/2 핵심: 시뮬레이션을 초기화하고 전체 상황 큐를 사전 생성한다. */
export function startSimulation(input: StartSimulationInput): Simulation {
  const programs = db.listPrograms(input.projectId);
  const resources = db.listResources(input.projectId);
  const risks = db.listRisks(input.projectId);
  const cases = db.listHistoricalCases();
  const windows = computePhaseWindows(programs);
  const selectedWindows = windows.filter((w) => input.phases.includes(w.phase));

  const startTime = selectedWindows.length > 0 ? selectedWindows[0].start : (programs[0]?.startTime ?? "09:00");

  const sim: Simulation = {
    id: uuid(),
    projectId: input.projectId,
    difficulty: input.difficulty,
    phases: input.phases,
    eventFrequency: input.eventFrequency,
    includedRiskCategories: input.includedRiskCategories,
    currentTime: startTime,
    status: "running",
    overallScore: 100,
    scheduleScore: 100,
    safetyScore: 100,
    productionScore: 100,
    clientScore: 100,
    costScore: 100,
    fatigueScore: 0,
    startedAt: new Date().toISOString(),
  };
  db.createSimulation(sim);

  const scenarios = generateInitialScenarios(sim, programs, resources, risks, cases, selectedWindows);
  db.addScenarios(scenarios);

  return sim;
}

function generateInitialScenarios(
  sim: Simulation,
  programs: EventProgram[],
  resources: Resource[],
  risks: Risk[],
  cases: HistoricalCase[],
  windows: ReturnType<typeof computePhaseWindows>
): Scenario[] {
  const scenarios: Scenario[] = [];
  const includedCategories = new Set(sim.includedRiskCategories);
  const relevantRisks = risks
    .filter((r) => includedCategories.has(r.category))
    .sort((a, b) => b.riskScore - a.riskScore);

  // 11.1 데이터 기반 필연적 상황: 위험 점수가 높은 리스크를 그대로 상황화한다.
  const deterministicRisks = relevantRisks.filter((r) => r.evidenceType === "manual" || r.evidenceType === "readiness").slice(0, 4);
  for (const risk of deterministicRisks) {
    const program = programs.find((p) => p.id === risk.relatedProgramId);
    const window = pickWindowForProgram(windows, program);
    scenarios.push(buildScenarioFromRisk(sim.id, risk, program, window));
  }

  // 11.3 과거 사례 기반 상황: 관련 태그가 겹치는 사례를 현재 행사에 맞게 변환한다.
  const relevantCases = cases.filter((c) => includedCategories.has((c.tags[0] as RiskCategory) ?? "schedule")).slice(0, 3);
  for (const historyCase of relevantCases) {
    const window = windows[Math.floor(Math.random() * windows.length)];
    if (!window) continue;
    scenarios.push(buildScenarioFromHistoricalCase(sim.id, historyCase, window, programs, resources));
  }

  // 11.2 확률적 돌발상황: 빈도 설정에 따라 템플릿에서 샘플링한다.
  const targetCount = FREQUENCY_COUNT[sim.eventFrequency] ?? 10;
  const remaining = Math.max(0, targetCount - scenarios.length);
  const applicableTemplates = PROBABILISTIC_TEMPLATES.filter(
    (t) => includedCategories.has(t.category) && t.applicablePhases.some((p) => sim.phases.includes(p as SimulationPhase))
  );
  const pool = applicableTemplates.length > 0 ? applicableTemplates : PROBABILISTIC_TEMPLATES;
  for (let i = 0; i < remaining; i++) {
    const template = pool[i % pool.length];
    const window = windows.find((w) => template.applicablePhases.includes(w.phase)) ?? windows[0];
    if (!window) continue;
    scenarios.push(buildScenarioFromTemplate(sim.id, template, window, programs, resources, sim.difficulty));
  }

  return scenarios.sort((a, b) => toMinutes(a.triggerTime) - toMinutes(b.triggerTime));
}

function pickWindowForProgram(windows: ReturnType<typeof computePhaseWindows>, program?: EventProgram) {
  if (!program) return windows[Math.floor(windows.length / 2)] ?? windows[0];
  const win = windows.find((w) => toMinutes(program.startTime) >= toMinutes(w.start) && toMinutes(program.startTime) <= toMinutes(w.end));
  return win ?? windows[Math.floor(windows.length / 2)] ?? windows[0];
}

function randomTimeIn(window: { start: string; end: string }): string {
  const startM = toMinutes(window.start);
  const endM = toMinutes(window.end);
  const span = Math.max(1, endM - startM);
  return toHHMM(startM + Math.floor(Math.random() * span));
}

function difficultyMultiplier(difficulty: Simulation["difficulty"]): number {
  return { easy: 0.7, normal: 1.0, hard: 1.3, live_ops: 1.6 }[difficulty] ?? 1.0;
}

function scaleEffects(e: ScoreEffects, mult: number): ScoreEffects {
  return {
    schedule: Math.round(e.schedule * mult),
    safety: Math.round(e.safety * mult),
    production: Math.round(e.production * mult),
    client: Math.round(e.client * mult),
    cost: Math.round(e.cost * mult),
    fatigue: Math.round(e.fatigue * mult),
  };
}

function buildScenarioFromRisk(
  simulationId: string, risk: Risk, program: EventProgram | undefined, window: ReturnType<typeof computePhaseWindows>[number]
): Scenario {
  const severity = risk.riskScore >= 16 ? "critical" : risk.riskScore >= 11 ? "high" : risk.riskScore >= 6 ? "medium" : "low";
  return {
    id: uuid(),
    simulationId,
    triggerTime: program?.startTime ? toHHMM(toMinutes(program.startTime) - 10) : randomTimeIn(window ?? { start: "09:00", end: "10:00" }),
    category: risk.category,
    title: risk.title,
    description: `${risk.description}\n\n(위험 등급: ${riskGrade(risk.riskScore)}, 근거: ${risk.evidenceType === "manual" ? "운영 매뉴얼" : "준비 현황표"})`,
    severity,
    relatedProgramId: risk.relatedProgramId,
    relatedResourceId: risk.relatedResourceId,
    sourceType: "deterministic_data",
    sourceReference: risk.evidenceText,
    status: "pending",
    options: buildGenericOptions(risk.title),
    decisionTimeLimitSec: 90,
  };
}

function buildScenarioFromHistoricalCase(
  simulationId: string, historyCase: HistoricalCase, window: ReturnType<typeof computePhaseWindows>[number],
  programs: EventProgram[], resources: Resource[]
): Scenario {
  const program = programs[Math.floor(Math.random() * programs.length)];
  return {
    id: uuid(),
    simulationId,
    triggerTime: randomTimeIn(window),
    category: (historyCase.tags[0] as RiskCategory) ?? "schedule",
    title: `[과거 사례 기반] ${historyCase.situation.slice(0, 24)}...`,
    description: `과거 유사 행사에서 다음과 같은 문제가 있었다. 현재 행사 구조에 맞게 변환된 상황이다.\n\n원인: ${historyCase.rootCause}\n이번 행사 맥락: ${program ? `${program.title} 진행 중 유사 조건 감지` : "행사 전반에서 유사 조건 감지"}`,
    severity: historyCase.severity >= 4 ? "high" : historyCase.severity >= 3 ? "medium" : "low",
    relatedProgramId: program?.id,
    sourceType: "historical_case",
    sourceReference: historyCase.id,
    status: "pending",
    options: buildGenericOptions(historyCase.situation, historyCase.prevention),
    decisionTimeLimitSec: 90,
    equipmentInvolved: resources.filter((r) => historyCase.relatedResources?.includes?.(r.name)).map((r) => r.name),
  };
}

function buildScenarioFromTemplate(
  simulationId: string, template: ScenarioTemplate, window: ReturnType<typeof computePhaseWindows>[number],
  programs: EventProgram[], resources: Resource[], difficulty: Simulation["difficulty"]
): Scenario {
  const relatedProgram = programs.find((p) => p.programType.includes(template.category)) ?? programs[Math.floor(Math.random() * programs.length)];
  const relatedResource = resources.find((r) => template.equipmentInvolved?.some((e) => r.name.includes(e)) || template.peopleInvolved?.some((p) => r.name.includes(p)))
    ?? resources[Math.floor(Math.random() * resources.length)];
  const ctx = {
    programTitle: relatedProgram?.title ?? "본 행사 프로그램",
    resourceName: relatedResource?.name ?? "관련 자원",
    minutesUntilShow: 0,
  };
  const mult = difficultyMultiplier(difficulty);
  const options: ScenarioOption[] = template.options(ctx).map((o) => ({
    id: uuid(),
    scenarioId: "",
    label: o.label,
    description: o.description,
    immediateEffects: scaleEffects(o.immediateEffects, mult),
    scoreEffects: scaleEffects(o.immediateEffects, mult),
    newRiskTriggers: o.newRiskTriggers,
  }));
  return {
    id: uuid(),
    simulationId,
    triggerTime: randomTimeIn(window),
    category: template.category,
    title: template.title,
    description: template.description(ctx),
    severity: template.severity,
    relatedProgramId: relatedProgram?.id,
    relatedResourceId: relatedResource?.id,
    sourceType: "probabilistic",
    sourceReference: template.key,
    status: "pending",
    options,
    decisionTimeLimitSec: 90,
    peopleInvolved: template.peopleInvolved,
    equipmentInvolved: template.equipmentInvolved,
  };
}

function buildGenericOptions(title: string, prevention?: string): ScenarioOption[] {
  return [
    { id: uuid(), scenarioId: "", label: "A", description: "즉시 담당자를 지정해 표준 대응 절차를 실행한다.", immediateEffects: { schedule: -2, safety: 1, production: 0, client: 0, cost: -1, fatigue: 2 }, scoreEffects: { schedule: -2, safety: 1, production: 0, client: 0, cost: -1, fatigue: 2 } },
    { id: uuid(), scenarioId: "", label: "B", description: prevention ? `과거 재발방지 대책을 적용한다: ${prevention}` : "예비 자원 또는 대체안을 즉시 가동한다.", immediateEffects: { schedule: -1, safety: 1, production: 1, client: 0, cost: -2, fatigue: 1 }, scoreEffects: { schedule: -1, safety: 1, production: 1, client: 0, cost: -2, fatigue: 1 } },
    { id: uuid(), scenarioId: "", label: "C", description: "우선 상황을 지켜보며 다음 체크포인트까지 대응을 보류한다.", immediateEffects: { schedule: 0, safety: -2, production: -2, client: -1, cost: 0, fatigue: 0 }, scoreEffects: { schedule: 0, safety: -2, production: -2, client: -1, cost: 0, fatigue: 0 }, newRiskTriggers: [`${title} 재발 또는 악화 위험`] },
  ];
}

/** 다음으로 발생해야 할 상황을 활성화하고 반환한다 (없으면 null). */
export function getNextScenario(simulationId: string): Scenario | null {
  const scenarios = db.listScenarios(simulationId).sort((a, b) => toMinutes(a.triggerTime) - toMinutes(b.triggerTime));
  const active = scenarios.find((s) => s.status === "active");
  if (active) return active;
  const next = scenarios.find((s) => s.status === "pending");
  if (!next) return null;
  db.updateScenario(next.id, { status: "active" });
  db.updateSimulation(simulationId, { currentTime: next.triggerTime });
  return { ...next, status: "active" };
}

export interface DecisionInput {
  simulationId: string;
  scenarioId: string;
  selectedOptionId?: string;
  customResponse?: string;
  reasoning?: string;
}

/** 사용자의 선택을 처리하고 점수를 갱신한 뒤, 결과 Decision을 반환한다. */
export function submitDecision(input: DecisionInput): { decision: Decision; simulation: Simulation; chainScenario: Scenario | null } {
  const sim = db.getSimulation(input.simulationId);
  const scenario = db.getScenario(input.scenarioId);
  if (!sim || !scenario) throw new Error("시뮬레이션 또는 상황을 찾을 수 없습니다.");

  let effects: ScoreEffects;
  let selectedOption: ScenarioOption | undefined;
  if (input.selectedOptionId) {
    selectedOption = scenario.options.find((o) => o.id === input.selectedOptionId);
    effects = selectedOption?.scoreEffects ?? { schedule: 0, safety: 0, production: 0, client: 0, cost: 0, fatigue: 0 };
  } else {
    // 직접 입력한 대응안은 표준 절차 대비 불확실성이 크므로 중립~약한 부정 효과 + 높은 불확실성으로 처리한다.
    effects = { schedule: -1, safety: 0, production: -1, client: 0, cost: -1, fatigue: 2 };
  }

  const updatedScores = applyEffects(sim, effects);
  const weights = deriveWeights(
    (db.getProject(sim.projectId)?.importanceLevel ?? "medium"),
    (db.getProject(sim.projectId)?.safetySensitivity ?? "medium")
  );
  const overallScore = calcOverallScore(updatedScores, weights);
  const updatedSim = db.updateSimulation(sim.id, { ...updatedScores, overallScore })!;

  db.updateScenario(scenario.id, { status: "resolved" });

  const decision: Decision = {
    id: uuid(),
    simulationId: sim.id,
    scenarioId: scenario.id,
    selectedOptionId: input.selectedOptionId,
    customResponse: input.customResponse,
    reasoning: input.reasoning,
    scoreChange: effects,
    createdAt: new Date().toISOString(),
    evaluation: buildEvaluation(scenario, selectedOption, effects, input.customResponse),
  };
  db.addDecision(decision);

  // 11.4 연쇄 상황: 선택한 옵션의 newRiskTriggers 중 하나를 후속 상황으로 즉시 큐에 추가한다.
  let chainScenario: Scenario | null = null;
  if (selectedOption?.newRiskTriggers?.length) {
    chainScenario = buildChainScenario(sim, scenario, selectedOption.newRiskTriggers[0]);
    db.addScenarios([chainScenario]);
  }

  return { decision, simulation: updatedSim, chainScenario };
}

function buildEvaluation(scenario: Scenario, option: ScenarioOption | undefined, effects: ScoreEffects, customResponse?: string) {
  const evidence = scenario.sourceType === "deterministic_data"
    ? [{ type: "manual" as const, label: "운영 매뉴얼 / 준비 현황 근거" }]
    : scenario.sourceType === "historical_case"
      ? [{ type: "historical_case" as const, label: "과거 결과보고서 사례 기반" }]
      : [{ type: "general_knowledge" as const, label: "일반 행사 운영 지식 기반 확률적 상황" }];

  return {
    immediateResult: customResponse
      ? `직접 입력한 대응안이 적용되었습니다: "${customResponse}"`
      : `선택지 ${option?.label ?? "-"}가 적용되었습니다: ${option?.description ?? ""}`,
    scheduleImpact: describeDelta(effects.schedule, "일정"),
    safetyImpact: describeDelta(effects.safety, "안전"),
    productionImpact: describeDelta(effects.production, "연출 완성도"),
    costImpact: describeDelta(effects.cost, "비용"),
    newRisks: option?.newRiskTriggers ?? [],
    evidence,
    betterAlternative: effects.safety < 0 || effects.schedule < -5
      ? "안전 또는 일정에 미치는 부정적 영향이 큽니다. 다음에는 담당자 조기 공유와 예비 자원 우선 사용을 고려하십시오."
      : undefined,
  };
}

function describeDelta(v: number, label: string): string {
  if (v > 0) return `${label} +${v} (긍정적 영향)`;
  if (v < 0) return `${label} ${v} (부정적 영향)`;
  return `${label} 변화 없음`;
}

function buildChainScenario(sim: Simulation, origin: Scenario, riskTitle: string): Scenario {
  return {
    id: uuid(),
    simulationId: sim.id,
    triggerTime: toHHMM(toMinutes(sim.currentTime) + 15 + Math.floor(Math.random() * 20)),
    category: "chain",
    title: `[연쇄 상황] ${riskTitle}`,
    description: `이전 판단(${origin.title})의 결과로 다음 문제가 새롭게 발생했다: ${riskTitle}`,
    severity: origin.severity === "critical" ? "critical" : "high",
    relatedProgramId: origin.relatedProgramId,
    relatedResourceId: origin.relatedResourceId,
    sourceType: "chain_reaction",
    sourceReference: origin.id,
    status: "pending",
    // 연쇄 상황의 선택지는 새로운 연쇄를 유발하지 않는다 (연쇄 깊이 1로 제한 — 무한 재연쇄 방지).
    options: buildTerminalOptions(),
    decisionTimeLimitSec: 60,
  };
}

function buildTerminalOptions(): ScenarioOption[] {
  return [
    { id: uuid(), scenarioId: "", label: "A", description: "담당자를 지정해 문제를 즉시 격리하고 복구 절차를 실행한다.", immediateEffects: { schedule: -3, safety: 1, production: 0, client: 0, cost: -2, fatigue: 3 }, scoreEffects: { schedule: -3, safety: 1, production: 0, client: 0, cost: -2, fatigue: 3 } },
    { id: uuid(), scenarioId: "", label: "B", description: "클라이언트와 관련 팀에 상황을 공유하고 조정된 계획으로 진행한다.", immediateEffects: { schedule: -2, safety: 0, production: -1, client: 2, cost: -1, fatigue: 2 }, scoreEffects: { schedule: -2, safety: 0, production: -1, client: 2, cost: -1, fatigue: 2 } },
    { id: uuid(), scenarioId: "", label: "C", description: "영향 범위를 축소해 해당 연출 요소를 축소·생략하고 안전하게 진행한다.", immediateEffects: { schedule: 1, safety: 2, production: -5, client: -2, cost: 0, fatigue: 1 }, scoreEffects: { schedule: 1, safety: 2, production: -5, client: -2, cost: 0, fatigue: 1 } },
  ];
}

/** 시뮬레이션 종료 처리 및 결과 리포트 생성 (Phase 2 필수 산출물). */
export function completeSimulation(simulationId: string): SimulationReport {
  const sim = db.getSimulation(simulationId);
  if (!sim) throw new Error("시뮬레이션을 찾을 수 없습니다.");
  db.updateSimulation(simulationId, { status: "completed", completedAt: new Date().toISOString() });

  const scenarios = db.listScenarios(simulationId);
  const decisions = db.listDecisions(simulationId);
  const programs = db.listPrograms(sim.projectId);
  const windows = computePhaseWindows(programs);

  const phaseIssueCounts: Record<string, number> = {};
  for (const sc of scenarios) {
    const win = windows.find((w) => toMinutes(sc.triggerTime) >= toMinutes(w.start) && toMinutes(sc.triggerTime) <= toMinutes(w.end));
    const label = win?.label ?? "미분류 구간";
    phaseIssueCounts[label] = (phaseIssueCounts[label] ?? 0) + 1;
  }
  const mostVulnerablePhase = Object.entries(phaseIssueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  const resourceCounts: Record<string, number> = {};
  for (const sc of scenarios) {
    if (sc.relatedResourceId) resourceCounts[sc.relatedResourceId] = (resourceCounts[sc.relatedResourceId] ?? 0) + 1;
  }
  const resources = db.listResources(sim.projectId);
  const riskiestResourceId = Object.entries(resourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const riskiestResource = resources.find((r) => r.id === riskiestResourceId)?.name ?? "-";

  const categoryCounts: Record<string, number> = {};
  for (const sc of scenarios) categoryCounts[sc.category] = (categoryCounts[sc.category] ?? 0) + 1;
  const mostRepeatedIssue = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  const goodDecisions = decisions
    .filter((d) => Object.values(d.scoreChange).slice(0, 5).reduce((a, b) => a + b, 0) >= 0 && d.scoreChange.safety >= 0)
    .map((d) => scenarios.find((s) => s.id === d.scenarioId)?.title ?? d.id)
    .slice(0, 5);

  const riskyDecisions = decisions
    .filter((d) => d.scoreChange.safety < 0 || d.scoreChange.schedule < -5)
    .map((d) => scenarios.find((s) => s.id === d.scenarioId)?.title ?? d.id)
    .slice(0, 5);

  const chainScenarios = scenarios.filter((s) => s.sourceType === "chain_reaction");
  const unresolvedItems = scenarios.filter((s) => s.status === "pending" || s.status === "expired").map((s) => s.title);

  return {
    simulationId: sim.id,
    projectId: sim.projectId,
    overallScore: sim.overallScore,
    scheduleScore: sim.scheduleScore,
    safetyScore: sim.safetyScore,
    productionScore: sim.productionScore,
    clientScore: sim.clientScore,
    costScore: sim.costScore,
    fatigueScore: sim.fatigueScore,
    mostVulnerablePhase,
    riskiestResource,
    mostRepeatedIssue: categoryLabel(mostRepeatedIssue),
    goodDecisions,
    riskyDecisions,
    unresolvedItems,
    mustFixBeforeEvent: db.listRisks(sim.projectId).filter((r) => r.riskScore >= 11 && r.status === "open").map((r) => r.title),
    recommendedRehearsals: chainScenarios.length > 0
      ? [`${mostVulnerablePhase} 구간 집중 재리허설`, "연쇄 상황이 발생한 프로그램 단독 큐 점검"]
      : [`${mostVulnerablePhase} 구간 집중 재리허설`],
    recommendedChecklist: [
      "리허설에서 미확인 상태로 남은 항목 재점검",
      "안전 점수에 영향을 준 판단에 대한 사전 승인 절차 마련",
      "예비 자원(배터리, 마이크, 서버) 수량 및 소진 시점 재확인",
    ],
    manualUpdateSuggestions: riskyDecisions.length > 0
      ? ["위험도가 높았던 판단 유형에 대한 표준 대응 절차를 운영 매뉴얼에 추가할 것을 권장합니다."]
      : ["이번 시뮬레이션에서는 매뉴얼에 즉시 반영할 만큼 위험한 판단은 발견되지 않았습니다."],
    generatedAt: new Date().toISOString(),
  };
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    schedule: "일정", staffing: "인력", equipment: "장비", content: "콘텐츠", presenter: "출연자",
    vehicle: "차량", robot: "로봇", safety: "안전", client: "클라이언트", audience: "관객",
    media: "미디어", weather: "날씨", venue: "장소", comms: "통신", power: "전력", chain: "연쇄 리스크",
  };
  return labels[cat] ?? cat;
}

export { PHASE_LABELS };
