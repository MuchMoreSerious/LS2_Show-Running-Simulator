import { describe, it, expect } from "vitest";
import { calcRiskScore, riskGrade } from "../risk";

describe("calcRiskScore", () => {
  it("계산식: Probability x Impact x Detectability", () => {
    expect(calcRiskScore(4, 5, 1.0)).toBe(20);
    expect(calcRiskScore(3, 3, 0.8)).toBe(7.2);
    expect(calcRiskScore(2, 2, 1.2)).toBe(4.8);
  });

  it("범위를 벗어난 입력은 1~5로 clamp된다", () => {
    expect(calcRiskScore(10, 10, 1.0)).toBe(25);
    expect(calcRiskScore(0, 0, 1.0)).toBe(1);
  });
});

describe("riskGrade", () => {
  it("점수 구간에 맞는 등급을 반환한다", () => {
    expect(riskGrade(3)).toBe("낮음");
    expect(riskGrade(8)).toBe("보통");
    expect(riskGrade(13)).toBe("높음");
    expect(riskGrade(20)).toBe("치명적");
  });
});
