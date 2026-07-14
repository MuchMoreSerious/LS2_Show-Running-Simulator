import { startSimulation } from "@/lib/simulation/engine";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { Difficulty, EventFrequency, RiskCategory, SimulationPhase } from "@/types/models";
import { requireOwnedProject } from "@/lib/ownership";

interface StartBody {
  difficulty: Difficulty;
  phases: SimulationPhase[];
  eventFrequency: EventFrequency;
  includedRiskCategories: RiskCategory[];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const owned = await requireOwnedProject(projectId);
  if ("error" in owned) return owned.error;

  const body = await parseBody<StartBody>(req);
  if (!body.phases?.length) return fail("시뮬레이션 구간을 1개 이상 선택해야 합니다.");
  if (!body.includedRiskCategories?.length) return fail("포함할 리스크 카테고리를 1개 이상 선택해야 합니다.");

  try {
    const sim = startSimulation({
      projectId,
      profileId: owned.profileId,
      difficulty: body.difficulty ?? "normal",
      phases: body.phases,
      eventFrequency: body.eventFrequency ?? "normal",
      includedRiskCategories: body.includedRiskCategories,
    });
    return ok(sim, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "시뮬레이션 시작 실패", 500);
  }
}
