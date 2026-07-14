import { submitDecision } from "@/lib/simulation/engine";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { requireOwnedSimulation } from "@/lib/ownership";

interface DecisionBody {
  scenarioId: string;
  selectedOptionId?: string;
  customResponse?: string;
  reasoning?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const owned = await requireOwnedSimulation(simId);
  if ("error" in owned) return owned.error;

  const body = await parseBody<DecisionBody>(req);
  if (!body.scenarioId) return fail("scenarioId가 필요합니다.");
  if (!body.selectedOptionId && !body.customResponse?.trim()) {
    return fail("선택지를 고르거나 직접 대응안을 입력해야 합니다.");
  }

  try {
    const result = submitDecision({
      simulationId: simId,
      scenarioId: body.scenarioId,
      selectedOptionId: body.selectedOptionId,
      customResponse: body.customResponse,
      reasoning: body.reasoning,
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "의사결정 처리 실패", 500);
  }
}
