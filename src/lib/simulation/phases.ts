import { EventProgram, SimulationPhase } from "@/types/models";
import { addMinutes, toMinutes } from "./time";

export interface PhaseWindow {
  phase: SimulationPhase;
  label: string;
  start: string;
  end: string;
}

export const PHASE_LABELS: Record<SimulationPhase, string> = {
  load_in: "설치 및 세팅",
  tech_rehearsal: "기술 리허설",
  full_rehearsal: "전체 리허설",
  pre_show: "행사 직전",
  show: "본 행사",
  load_out: "철수",
};

/**
 * 프로그램 타임테이블(본 행사 구간)을 기준으로 나머지 구간의 시간창을 역산한다.
 * 실제 데이터가 없는 리허설/설치 구간은 통상적인 행사 준비 관례치를 사용한다
 * (AI 추정이 아니라 엔진의 일반 스케줄링 규칙이며, UI에는 "표준 준비 일정 기준"으로 표기한다).
 */
export function computePhaseWindows(programs: EventProgram[]): PhaseWindow[] {
  if (programs.length === 0) {
    return [];
  }
  const sorted = [...programs].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const showStart = sorted[0].startTime;
  const showEnd = sorted[sorted.length - 1].endTime;

  return [
    { phase: "load_in", label: PHASE_LABELS.load_in, start: addMinutes(showStart, -240), end: addMinutes(showStart, -180) },
    { phase: "tech_rehearsal", label: PHASE_LABELS.tech_rehearsal, start: addMinutes(showStart, -180), end: addMinutes(showStart, -90) },
    { phase: "full_rehearsal", label: PHASE_LABELS.full_rehearsal, start: addMinutes(showStart, -90), end: addMinutes(showStart, -30) },
    { phase: "pre_show", label: PHASE_LABELS.pre_show, start: addMinutes(showStart, -30), end: showStart },
    { phase: "show", label: PHASE_LABELS.show, start: showStart, end: showEnd },
    { phase: "load_out", label: PHASE_LABELS.load_out, start: showEnd, end: addMinutes(showEnd, 60) },
  ];
}
