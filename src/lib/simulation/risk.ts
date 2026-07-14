// Risk Score = Probability x Impact x Detectability Modifier
// Probability: 1(매우낮음) ~ 5(매우높음)
// Impact: 1(경미) ~ 5(치명적)
// Detectability Modifier: 0.8(발견쉬움) | 1.0(보통) | 1.2(발견어려움)

export const DETECTABILITY = {
  easy: 0.8,
  normal: 1.0,
  hard: 1.2,
} as const;

export type DetectabilityKey = keyof typeof DETECTABILITY;

export function calcRiskScore(probability: number, impact: number, detectabilityMod: number): number {
  const p = clamp(probability, 1, 5);
  const i = clamp(impact, 1, 5);
  return Math.round(p * i * detectabilityMod * 100) / 100;
}

export type RiskGrade = "낮음" | "보통" | "높음" | "치명적";

export function riskGrade(score: number): RiskGrade {
  if (score >= 16) return "치명적";
  if (score >= 11) return "높음";
  if (score >= 6) return "보통";
  return "낮음";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
