import { describe, it, expect } from "vitest";
import { applyEffects, calcOverallScore, deriveWeights, DEFAULT_WEIGHTS } from "../scoring";
import { Simulation } from "@/types/models";

const baseSim: Simulation = {
  id: "sim-1", projectId: "p-1", difficulty: "normal", phases: ["show"], eventFrequency: "normal",
  includedRiskCategories: ["schedule"], currentTime: "09:00", status: "running",
  overallScore: 100, scheduleScore: 100, safetyScore: 100, productionScore: 100,
  clientScore: 100, costScore: 100, fatigueScore: 0,
};

describe("deriveWeights", () => {
  it("기본 가중치의 합은 1.0이다", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
  });

  it("안전 민감도가 high면 안전 가중치가 40%까지 올라가고 합은 여전히 1.0이다", () => {
    const w = deriveWeights("high", "high");
    expect(w.safety).toBeCloseTo(0.4, 5);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("calcOverallScore", () => {
  it("모든 점수가 100이면 종합점수도 100이다", () => {
    expect(calcOverallScore(baseSim)).toBe(100);
  });

  it("안전 점수가 하락하면 종합점수도 하락한다", () => {
    const score = calcOverallScore({ ...baseSim, safetyScore: 50 });
    expect(score).toBeLessThan(100);
  });
});

describe("applyEffects", () => {
  it("효과를 적용하면 점수가 0~100 범위로 clamp된다", () => {
    const result = applyEffects(baseSim, { schedule: -200, safety: 0, production: 0, client: 0, cost: 0, fatigue: 10 });
    expect(result.scheduleScore).toBe(0);
    expect(result.fatigueScore).toBe(10);
  });

  it("피로도는 100을 넘어도 계속 누적될 수 있다", () => {
    const tired = { ...baseSim, fatigueScore: 95 };
    const result = applyEffects(tired, { schedule: 0, safety: 0, production: 0, client: 0, cost: 0, fatigue: 10 });
    expect(result.fatigueScore).toBe(105);
  });
});
