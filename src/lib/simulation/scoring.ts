import { ImportanceLevel, SafetySensitivity, ScoreEffects, Simulation } from "@/types/models";

export interface Weights {
  safety: number;
  schedule: number;
  production: number;
  client: number;
  cost: number;
  fatigue: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  safety: 0.30,
  schedule: 0.20,
  production: 0.20,
  client: 0.15,
  cost: 0.10,
  fatigue: 0.05,
};

/**
 * 행사 유형과 중요도, 안전 민감도에 따라 가중치를 조정한다.
 * 안전 민감도가 high인 행사는 안전 가중치를 최대 40%까지 올리고,
 * 나머지 가중치는 비례 축소해 합이 1.0을 유지하도록 한다.
 */
export function deriveWeights(
  importanceLevel: ImportanceLevel,
  safetySensitivity: SafetySensitivity
): Weights {
  const base = { ...DEFAULT_WEIGHTS };

  let safetyTarget = base.safety;
  if (safetySensitivity === "high") safetyTarget = 0.40;
  else if (safetySensitivity === "medium") safetyTarget = 0.33;

  if (importanceLevel === "critical") safetyTarget = Math.min(0.40, safetyTarget + 0.03);

  const delta = safetyTarget - base.safety;
  if (delta === 0) return base;

  const others: (keyof Weights)[] = ["schedule", "production", "client", "cost", "fatigue"];
  const othersTotal = others.reduce((sum, k) => sum + base[k], 0);
  const scaled: Weights = { ...base, safety: safetyTarget };
  for (const k of others) {
    scaled[k] = Math.max(0, base[k] - (delta * (base[k] / othersTotal)));
  }
  return scaled;
}

/** 100점 만점 기준(피로도는 0점 시작, 높을수록 부정적)의 종합 준비도 점수를 계산한다. */
export function calcOverallScore(
  scores: Pick<Simulation, "scheduleScore" | "safetyScore" | "productionScore" | "clientScore" | "costScore" | "fatigueScore">,
  weights: Weights = DEFAULT_WEIGHTS
): number {
  const fatiguePenalty = Math.min(100, scores.fatigueScore); // 0(양호)~100(탈진)
  const fatigueAsPositive = 100 - fatiguePenalty;
  const total =
    scores.safetyScore * weights.safety +
    scores.scheduleScore * weights.schedule +
    scores.productionScore * weights.production +
    scores.clientScore * weights.client +
    scores.costScore * weights.cost +
    fatigueAsPositive * weights.fatigue;
  return Math.round(total * 10) / 10;
}

/** 선택지의 효과를 시뮬레이션 점수에 적용한다 (0~100 클램프, 피로도는 0 이상 무제한 누적). */
export function applyEffects(
  sim: Simulation,
  effects: ScoreEffects
): Pick<Simulation, "scheduleScore" | "safetyScore" | "productionScore" | "clientScore" | "costScore" | "fatigueScore"> {
  return {
    scheduleScore: clamp(sim.scheduleScore + effects.schedule),
    safetyScore: clamp(sim.safetyScore + effects.safety),
    productionScore: clamp(sim.productionScore + effects.production),
    clientScore: clamp(sim.clientScore + effects.client),
    costScore: clamp(sim.costScore + effects.cost),
    fatigueScore: Math.max(0, sim.fatigueScore + effects.fatigue),
  };
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}
