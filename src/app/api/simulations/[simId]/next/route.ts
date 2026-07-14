import { db } from "@/lib/db/store";
import { getNextScenario } from "@/lib/simulation/engine";
import { ok, fail } from "@/lib/api-utils";

export async function POST(_req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const sim = db.getSimulation(simId);
  if (!sim) return fail("시뮬레이션을 찾을 수 없습니다.", 404);
  if (sim.status === "completed") return fail("이미 종료된 시뮬레이션입니다.");

  const scenario = getNextScenario(simId);
  const updated = db.getSimulation(simId)!;
  return ok({ scenario, simulation: updated, finished: scenario === null });
}
