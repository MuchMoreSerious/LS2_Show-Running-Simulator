import { db } from "@/lib/db/store";
import { ok, fail } from "@/lib/api-utils";
import { computePhaseWindows } from "@/lib/simulation/phases";
import { toMinutes } from "@/lib/simulation/time";

export async function GET(_req: Request, { params }: { params: Promise<{ simId: string }> }) {
  const { simId } = await params;
  const sim = db.getSimulation(simId);
  if (!sim) return fail("시뮬레이션을 찾을 수 없습니다.", 404);

  const scenarios = db.listScenarios(simId).sort((a, b) => toMinutes(a.triggerTime) - toMinutes(b.triggerTime));
  const decisions = db.listDecisions(simId);
  const programs = db.listPrograms(sim.projectId);
  const resources = db.listResources(sim.projectId);
  const windows = computePhaseWindows(programs);

  const total = scenarios.length;
  const resolved = scenarios.filter((s) => s.status === "resolved").length;

  return ok({
    simulation: sim,
    scenarios,
    decisions,
    programs,
    resources,
    phaseWindows: windows.filter((w) => sim.phases.includes(w.phase)),
    progress: total > 0 ? Math.round((resolved / total) * 100) : 0,
  });
}
