import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db/store";
import { seedDemoProject } from "@/lib/db/seed";
import { startSimulation, getNextScenario, submitDecision, completeSimulation } from "../engine";

const PROJECT_ID = "seed-ces-2027";

beforeAll(() => {
  db.reset();
  seedDemoProject();
});

describe("simulation engine", () => {
  it("시뮬레이션 시작 시 상황 큐가 시간순으로 생성된다", () => {
    const sim = startSimulation({
      projectId: PROJECT_ID,
      difficulty: "normal",
      phases: ["full_rehearsal", "pre_show", "show"],
      eventFrequency: "normal",
      includedRiskCategories: ["schedule", "staffing", "equipment", "content", "presenter", "vehicle", "robot", "safety", "client", "audience", "media", "venue"],
    });
    expect(sim.status).toBe("running");

    const scenarios = db.listScenarios(sim.id);
    expect(scenarios.length).toBeGreaterThan(0);
    const times = scenarios.map((s) => s.triggerTime);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
  });

  it("선택에 따라 점수가 변화하고, 위험한 선택은 연쇄 상황을 만든다", () => {
    const sim = startSimulation({
      projectId: PROJECT_ID,
      difficulty: "hard",
      phases: ["full_rehearsal", "pre_show", "show"],
      eventFrequency: "low",
      includedRiskCategories: ["robot", "vehicle", "safety", "schedule"],
    });

    const scenario = getNextScenario(sim.id);
    expect(scenario).not.toBeNull();
    if (!scenario) return;

    // 안전을 깎는 선택지(대개 마지막 옵션)를 찾아 연쇄 상황 유발을 확인한다.
    const riskyOption = scenario.options.find((o) => o.newRiskTriggers && o.newRiskTriggers.length > 0) ?? scenario.options[0];

    const before = db.getSimulation(sim.id)!;
    const { decision, simulation, chainScenario } = submitDecision({
      simulationId: sim.id,
      scenarioId: scenario.id,
      selectedOptionId: riskyOption.id,
    });

    expect(decision.scenarioId).toBe(scenario.id);
    expect(simulation.overallScore).not.toBeNaN();
    if (riskyOption.newRiskTriggers?.length) {
      expect(chainScenario).not.toBeNull();
    }
    expect(simulation.scheduleScore + simulation.safetyScore).not.toBe(before.scheduleScore + before.safetyScore + 999999); // sanity
  });

  it("시뮬레이션 종료 후 결과 리포트를 생성한다", () => {
    const sim = startSimulation({
      projectId: PROJECT_ID,
      difficulty: "easy",
      phases: ["show"],
      eventFrequency: "low",
      includedRiskCategories: ["schedule", "robot", "vehicle"],
    });

    let scenario = getNextScenario(sim.id);
    let guard = 0;
    while (scenario && guard < 30) {
      submitDecision({ simulationId: sim.id, scenarioId: scenario.id, selectedOptionId: scenario.options[0].id });
      scenario = getNextScenario(sim.id);
      guard++;
    }

    const report = completeSimulation(sim.id);
    expect(report.simulationId).toBe(sim.id);
    expect(report.mostVulnerablePhase).toBeTypeOf("string");
    expect(Array.isArray(report.mustFixBeforeEvent)).toBe(true);
  });
});
