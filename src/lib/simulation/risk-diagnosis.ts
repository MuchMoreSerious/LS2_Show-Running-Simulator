import { v4 as uuid } from "uuid";
import { Dependency, EventProgram, ProjectDocument, Resource, Risk } from "@/types/models";
import { calcRiskScore } from "./risk";
import { toMinutes } from "./time";

/**
 * 요구사항 §8.5의 12개 위험 카테고리를 결정론적 규칙으로 진단한다.
 * (AI 호출 없이도 동작 — 문서 검토 후 확정된 프로그램/리소스 데이터를 기반으로 한다.)
 */
export function diagnoseRisks(
  projectId: string,
  programs: EventProgram[],
  resources: Resource[],
  dependencies: Dependency[],
  documents: ProjectDocument[]
): Risk[] {
  const risks: Risk[] = [];
  const push = (r: Omit<Risk, "id" | "projectId" | "riskScore" | "status">) => {
    risks.push({
      id: uuid(),
      projectId,
      status: "open",
      riskScore: calcRiskScore(r.probability, r.impact, r.detectabilityMod),
      ...r,
    });
  };

  // 1) 시간 충돌: 같은 장소에서 시간대가 겹치는 프로그램
  for (let i = 0; i < programs.length; i++) {
    for (let j = i + 1; j < programs.length; j++) {
      const a = programs[i], b = programs[j];
      if (a.location && a.location === b.location && overlaps(a, b)) {
        push({
          title: `시간 충돌: ${a.title} / ${b.title}`,
          category: "schedule",
          description: `"${a.title}"(${a.startTime}-${a.endTime})와 "${b.title}"(${b.startTime}-${b.endTime})가 동일 장소(${a.location})에서 시간이 겹칩니다.`,
          probability: 5, impact: 4, detectabilityMod: 0.8,
          relatedProgramId: a.id,
          evidenceType: "manual",
          evidenceText: "전체 타임테이블 근거",
          mitigation: "두 프로그램 중 하나의 시간 또는 장소를 조정하십시오.",
        });
      }
    }
  }

  // 2) 인력 중복 배정
  for (let i = 0; i < programs.length; i++) {
    for (let j = i + 1; j < programs.length; j++) {
      const a = programs[i], b = programs[j];
      const shared = a.responsiblePersons.filter((p) => b.responsiblePersons.includes(p));
      if (shared.length > 0 && overlaps(a, b)) {
        push({
          title: `인력 중복 배정: ${shared.join(", ")}`,
          category: "staffing",
          description: `${shared.join(", ")}이(가) "${a.title}"와 "${b.title}"에 동시에 배정되어 있습니다.`,
          probability: 4, impact: 3, detectabilityMod: 0.8,
          relatedProgramId: a.id,
          evidenceType: "manual",
          evidenceText: "인력 배치표 근거",
          mitigation: "백업 인력을 지정하거나 담당 시간을 조정하십시오.",
        });
      }
    }
  }

  // 3) 장비/리소스 준비 미완료
  for (const resource of resources) {
    if (resource.status === "pending" || resource.status === "at_risk") {
      push({
        title: `준비 미완료 자원: ${resource.name}`,
        category: resource.resourceType === "content" ? "content" : resource.resourceType === "vehicle" ? "vehicle" : resource.resourceType === "robot" ? "robot" : "equipment",
        description: `${resource.name}의 준비 상태가 "${resource.status}"입니다. 예비 자원 확보 여부: ${resource.backupAvailable ? "있음" : "없음"}.`,
        probability: resource.status === "at_risk" ? 4 : 3,
        impact: resource.criticality === "critical" ? 5 : resource.criticality === "high" ? 4 : 3,
        detectabilityMod: resource.backupAvailable ? 0.8 : 1.2,
        relatedResourceId: resource.id,
        evidenceType: "readiness",
        evidenceText: "준비 현황표 근거",
        mitigation: resource.backupAvailable ? "예비 자원 준비 상태를 최종 확인하십시오." : "예비 자원 확보 계획을 즉시 수립하십시오.",
      });
    }
  }

  // 4) 의사결정권자 부재
  for (const program of programs) {
    if (!program.decisionMaker) {
      push({
        title: `의사결정권자 미지정: ${program.title}`,
        category: "client",
        description: `"${program.title}" 프로그램에 문제 발생 시 최종 결정을 내릴 담당자가 지정되어 있지 않습니다.`,
        probability: 3, impact: 3, detectabilityMod: 1.0,
        relatedProgramId: program.id,
        evidenceType: "manual",
        mitigation: "프로그램별 의사결정권자를 사전에 지정하고 공유하십시오.",
      });
    }
  }

  // 5) 대체안 미비 (중요 프로그램)
  for (const program of programs) {
    if (program.backupPlans.length === 0) {
      push({
        title: `대체안 미비: ${program.title}`,
        category: "schedule",
        description: `"${program.title}"에 문제가 발생했을 때 사용할 대체안이 문서에 명시되어 있지 않습니다.`,
        probability: 3, impact: 3, detectabilityMod: 1.2,
        relatedProgramId: program.id,
        evidenceType: "manual",
        mitigation: "최소한의 대체 진행 시나리오를 마련하십시오.",
      });
    }
  }

  // 6) 프로그램/장비 간 의존성 리스크
  for (const dep of dependencies) {
    push({
      title: `의존성 리스크: ${dep.description ?? dep.dependencyType}`,
      category: "schedule",
      description: dep.description ?? `${dep.sourceType} → ${dep.targetType} (${dep.dependencyType})`,
      probability: 3, impact: 3, detectabilityMod: 1.0,
      evidenceType: "manual",
      mitigation: "의존 관계가 끊어질 경우의 대응 절차를 사전에 정의하십시오.",
    });
  }

  // 7) 안전 관련 미확인 사항 (백업 없는 critical 자원)
  for (const resource of resources) {
    if (resource.criticality === "critical" && !resource.backupAvailable) {
      push({
        title: `안전 미확인: ${resource.name} 백업 부재`,
        category: "safety",
        description: `안전에 영향을 줄 수 있는 핵심 자원 "${resource.name}"에 예비 수단이 없습니다.`,
        probability: 2, impact: 5, detectabilityMod: 1.2,
        relatedResourceId: resource.id,
        evidenceType: "readiness",
        mitigation: "안전 관련 핵심 자원은 반드시 예비 수단을 확보하십시오.",
      });
    }
  }

  // 8) 문서 간 정보 불일치 (AI 구조화 단계에서 감지된 documentConflicts)
  for (const doc of documents) {
    const conflicts = (doc.analysisResult as { documentConflicts?: string[] } | undefined)?.documentConflicts ?? [];
    for (const conflict of conflicts) {
      push({
        title: `문서 간 정보 불일치`,
        category: "schedule",
        description: conflict,
        probability: 3, impact: 3, detectabilityMod: 1.0,
        evidenceType: "manual",
        evidenceText: `${doc.filename} 등 여러 문서 비교 근거`,
        mitigation: "사용자가 최종 기준 정보를 선택해야 합니다.",
      });
    }
  }

  return risks;
}

function overlaps(a: EventProgram, b: EventProgram): boolean {
  const aStart = toMinutes(a.startTime), aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime), bEnd = toMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}
