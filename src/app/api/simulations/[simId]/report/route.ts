import { db } from "@/lib/db/store";
import { completeSimulation } from "@/lib/simulation/engine";
import { ok, fail } from "@/lib/api-utils";
import { SimulationReport } from "@/types/models";

export async function POST(_req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const sim = db.getSimulation(simId);
  if (!sim) return fail("시뮬레이션을 찾을 수 없습니다.", 404);

  try {
    const report = completeSimulation(simId);
    return ok(report);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "리포트 생성 실패", 500);
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const sim = db.getSimulation(simId);
  if (!sim) return fail("시뮬레이션을 찾을 수 없습니다.", 404);
  if (sim.status !== "completed") return fail("아직 종료되지 않은 시뮬레이션입니다.");

  const report = completeSimulation(simId); // idempotent 재생성
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "markdown") {
    const project = db.getProject(sim.projectId);
    const md = reportToMarkdown(report, project?.name ?? "행사");
    return new Response(md, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="showrunner-report-${simId.slice(0, 8)}.md"`,
      },
    });
  }
  return ok(report);
}

function reportToMarkdown(r: SimulationReport, projectName: string): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- 해당 없음");
  return `# SHOWRUNNER 시뮬레이션 결과 리포트

**행사:** ${projectName}
**생성 시각:** ${r.generatedAt}

## 종합 점수

| 항목 | 점수 |
|---|---|
| 종합 준비도 | ${r.overallScore} |
| 일정 준수 | ${r.scheduleScore} |
| 안전 | ${r.safetyScore} |
| 연출 완성도 | ${r.productionScore} |
| 고객 만족 예상 | ${r.clientScore} |
| 비용 통제 | ${r.costScore} |
| 팀 피로도 | ${r.fatigueScore} (높을수록 부정적) |

## 취약 분석

- **가장 취약한 구간:** ${r.mostVulnerablePhase}
- **가장 위험한 자원:** ${r.riskiestResource}
- **가장 반복된 문제:** ${r.mostRepeatedIssue}

## 잘한 대응

${list(r.goodDecisions)}

## 위험했던 대응

${list(r.riskyDecisions)}

## 미확인 사항

${list(r.unresolvedItems)}

## 행사 전 반드시 해결할 항목

${list(r.mustFixBeforeEvent)}

## 추천 추가 리허설

${list(r.recommendedRehearsals)}

## 추천 체크리스트

${list(r.recommendedChecklist)}

## 실제 운영 매뉴얼 반영 제안

${list(r.manualUpdateSuggestions)}

---
*이 리포트는 SHOWRUNNER 데스크 리허설 시뮬레이션 결과입니다. 점수는 결과를 설명하기 위한 보조 수단이며, 실제 행사 준비 판단은 담당자의 검토를 거쳐야 합니다.*
`;
}
