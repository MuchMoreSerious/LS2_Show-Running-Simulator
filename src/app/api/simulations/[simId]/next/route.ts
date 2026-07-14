import { db } from "@/lib/db/store";
import { getNextScenario } from "@/lib/simulation/engine";
import { ok, fail } from "@/lib/api-utils";
import { requireOwnedSimulation } from "@/lib/ownership";

export async function POST(_req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const owned = await requireOwnedSimulation(simId);
  if ("error" in owned) return owned.error;
  if (owned.simulation.status === "completed") return fail("이미 종료된 시뮬레이션입니다.");

  const scenario = getNextScenario(simId);
  const updated = db.getSimulation(simId)!;
  return ok({ scenario, simulation: updated, finished: scenario === null });
}
